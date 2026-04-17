import "dotenv/config";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { ChatOpenAI } from "@langchain/openai";
import chalk from "chalk";
import {
  ToolMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const myClient = new MultiServerMCPClient({
  mcpServers: {
    "my-mcp-server": {
      command: "node",
      args: [
        "/Users/daixiaopei/program/ai-agent-course/tool-test/src/my-mcp-server.mjs",
      ],
    },
  },
});

const tools = await myClient.getTools();
const modelWithTools = model.bindTools(tools);

// 使用工具
// await runAgentWithTools("查一下用户005的信息");

// 获取mcp的静态资源
const res = await myClient.listResources();

let resourceContent = "";
for (const [serverName, resources] of Object.entries(res)) {
  for (const resource of resources) {
    const content = await myClient.readResource(serverName, resource.uri);
    resourceContent += content[0].text;
    // console.log(content);
  }
}

async function runAgentWithTools(query, maxTimes = 30) {
  const message = [new SystemMessage(resourceContent), new HumanMessage(query)];
  for (let i = 0; i < maxTimes; i++) {
    console.log(chalk.bgGreen(`⏳ 正在等待 AI 思考...`));
    const response = await modelWithTools.invoke(message);
    message.push(response);
    if (response.tool_calls && response.tool_calls.length > 0) {
      console.log(
        chalk.bgBlue(`检测到一共有${response.tool_calls.length}个工具`),
      );
      console.log(
        chalk.bgBlue(
          `🔍 工具调用: ${response.tool_calls.map((t) => t.name).join(", ")}`,
        ),
      );
      for (const toolCall of response.tool_calls) {
        const foundTool = tools.find((e) => e.name === toolCall.name);
        if (!foundTool) {
          return `没有找到工具`;
        }
        const resultTool = await foundTool.invoke(toolCall.args);
        message.push(
          new ToolMessage({
            tool_call_id: toolCall.id,
            content: resultTool,
          }),
        );
      }
    } else {
      console.log(`\n✨ AI 最终回复:\n${response.content}\n`);
      return response.content;
    }
  }
  return message[message.length - 1].content;
}
// console.log(res);
await runAgentWithTools("MCP 的使用指南是什么");
await myClient.close();
