import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import fs from "node:fs/promises";
import { z } from "zod";

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME || "Qwen3-Coder-Plus",
  apiKey: process.env.OPENAI_API_KEY,
  // AI的创造性，设置为0，就是严格按照指令来做事，不要随意发挥
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

// 创建一个tool,调用tool的api
const readFileTool = tool(
  async ({ filePath }) => {
    const content = await fs.readFile(filePath, "utf-8");
    console.log(
      `[工具调用] read_file("${filePath}") - 成功读取 ${content.length} 字节`,
    );
    return `文件内容: \n${content}`;
  },
  {
    name: "read_file",
    description:
      "用此工具来读取文件，当用户要求读取文件，查看代码，分析文件内容时，调用此工具。输入文件路径（可以是相对路径或者绝对路径）",
    schema: z.object({
      filePath: z.string().describe("要读取的文件路径"),
    }),
  },
);
const tools = [readFileTool];

const modelWidthTools = model.bindTools(tools);

/**
 * SystemMessage:设置AI是谁，可以干什么，有什么能力，以及一些回答，行为规范等
 * HumanMessage:用户输入的信息
 * AIMessage:AI的回复信息
 *ToolMessage:调用工具的结果返回
 */

const messages = [
  new SystemMessage(`你是一个代码助手，可以使用工具读取文件并解释代码。
    工作流程：
    1.用户要求读取文件的时候，立即调用read_file工具
    2.等待工具返回文件内容
    3.基于文件内容进行分析和解释

    可用工具：
    -read_file:读取文件内容（使用此工具来获取文件内容）
    `),
  new HumanMessage(`请读取 src/tool-file-read.mjs 文件内容并解释代码`),
];
let response = await modelWidthTools.invoke(messages);
//console.log(response);

// tool_call 的结果
/**
 *   "tool_calls": [
    {
      "name": "read_file",
      "args": {
        "filePath": "src/tool-file-read.mjs"
      },
      "type": "tool_call",
      "id": "call_480437e0482d4659b1f70aa9"
    }
  ],
 */
messages.push(response); // 把AI返回的消息，放回到message中，也就是对话记录
while (response.tool_calls && response.tool_calls.length) {
  console.log(`\n[检测到 ${response.tool_calls.length} 个工具调用]`);
  // 执行所有工具调用
  const toolResults = await Promise.all(
    response.tool_calls.map(async (toolCall) => {
      const tool = tools.find((t) => t.name === toolCall.name); // 查找工具
      if (!tool) {
        return `错误，找不到工具${toolCall.name}`;
      }
      console.log(
        `  [执行工具] ${toolCall.name}(${JSON.stringify(toolCall.args)})`,
      );
      try {
        const result = await tool.invoke(toolCall.args); // 调用工具
        return result;
      } catch (e) {
        return `错误：${e.message}`;
      }
    }),
  );
  // 将工具结果添加到消息历史
  response.tool_calls.forEach((toolCall, index) => {
    messages.push(
      new ToolMessage({
        content: toolResults[index],
        tool_call_id: toolCall.id,
      }),
    );
  });
  // 再次调用模型，传入工具结果
  response = await modelWidthTools.invoke(messages);
  messages.push(response);
}
console.log("最终答复");
console.log(response.content);
