import "dotenv/config";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import chalk from "chalk";

// 新建模型
const model = new ChatOpenAI({
  model: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

// 创建一个mcpServer
const mcpClient = new MultiServerMCPClient({
  mcpServers: {
    "amap-maps-streamableHTTP": {
      // 高德的mcp
      url: `https://mcp.amap.com/mcp?key=f0dd528a2253cc3ba3caf77cc31f2ca4`,
    },
    filesystem: {
      command: "npx", // 表示启动一个子进程，用npx运行一个npm包
      args: [
        "-y", // 表示自动安装，避免交互提示
        "@modelcontextprotocol/server-filesystem", // 要运行的MCP文件系统服务包
        ...(process.env.ALLOWED_PATHS.split(",") || ""),
      ],
    },
    "chrome-devtools": {
      command: "npx",
      args: ["-y", "chrome-devtools-mcp@latest"],
    },
  },
});

const tools = await mcpClient.getTools();
const modelWithTools = model.bindTools(tools);

async function runAgentWithTools(query, maxTimes = 30) {
  const messages = [new HumanMessage(query)];
  for (let i = 0; i < maxTimes; i++) {
    console.log(chalk.bgGreen("AI开始思考"));
    const response = await modelWithTools.invoke(messages);
    messages.push(response);
    if (!response.tool_calls || response.tool_calls.length === 0) {
      console.log(`AI的最终回复是:${response.content}`);
      return response.content;
    }
    console.log(
      chalk.bgBlue(`一共有${response.tool_calls.length}个工具被调用`),
    );
    console.log(
      chalk.bgRed(
        `🔍 工具调用: ${response.tool_calls.map((t) => t.name).join(", ")}`,
      ),
    );
    for (const toolCall of response.tool_calls) {
      const foundTool = tools.find((t) => t.name === toolCall.name);
      if (!foundTool) {
        console.log("没有找到合适的工具");
        return "没有找到合适的工具";
      }
      const resultTool = await foundTool.invoke(toolCall.args);
      let contentStr = "";
      if (typeof resultTool === "string") {
        contentStr = resultTool;
      } else if (resultTool && resultTool.text) {
        contentStr = resultTool.text;
      }
      messages.push(
        new ToolMessage({
          content: contentStr,
          tool_call_id: toolCall.id,
        }),
      );
    }
  }
  return messages[messages.length - 1].content;
}

await runAgentWithTools(
  "北京南站附近的酒店，最近的 3 个酒店，拿到酒店图片，打开浏览器，展示每个酒店的图片，每个 tab 一个 url 展示，并且在把那个页面标题改为酒店名",
);
await mcpClient.close();
