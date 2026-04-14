import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import {
  SystemMessage,
  HumanMessage,
  ToolMessage,
} from "@langchain/core/messages";
import {
  readFileTool,
  writeTool,
  executeCommandTool,
  listDirectoryTool,
} from "./all-tools.mjs";
import chalk from "chalk";

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const tools = [readFileTool, writeTool, executeCommandTool, listDirectoryTool];

// 绑定tools到模型上面
const modelWithTools = model.bindTools(tools);

// Agent 执行函数
async function runAgentWithTools(query, maxIterations = 30) {
  const messages = [
    // System message 指定 AI 可以做什么，回答的规范，可以使用的工具
    new SystemMessage(`你是一个项目管理助手，使用工具完成任务
      当前工作目录 ${process.cwd()}
      工具：
      1.read_file:读取文件
      2.write_file:写入文件
      3.execute_command:执行命令（支持workingDirectory参数），
      4.list_directory:列出目录
      重要规则：execute_command
      -workingDirectory 会自动切换到指定目录
      -当使用workingDirectory 时，不要使用cd
      -错误示例：{ command: "cd react-todo-app && pnpm install", workingDirectory: "react-todo-app" }
                这是错误的！因为 workingDirectory 已经在 react-todo-app 目录了，再 cd react-todo-app 会找不到目录
      -正确示例：{ command: "pnpm install", workingDirectory: "react-todo-app" }
                这样就对了！workingDirectory 已经切换到 react-todo-app，直接执行命令即可
      回复要简洁，只说做了什么
    `),
    new HumanMessage(query),
  ];
  for (let i = 0; i < maxIterations; i++) {
    console.log(chalk.bgGreen("正在等待ai思考"));
    const response = await modelWithTools.invoke(messages);
    /**
    response是模型调用后返回的值，不是字符串，是一个对象
    典型结构大致像：
    response.content:模型生成的文本
    response.tool_call:这里是返回的模型可以调用的工具
    * */
    messages.push(response); // 把AI这一次的回复当成新的消息，加入到历史对话里面
    if (response.tool_calls && response.tool_calls.length > 0) {
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
      // 对 tools工具进行循环
      for (const toolCall of response.tool_calls) {
        const foundTool = tools.find((e) => e.name === toolCall.name);
        if (foundTool) {
          const toolResult = await foundTool.invoke(toolCall.args);
          //把工具执行结果塞进messages里面
          // ToolMessage 的结构通常用来告诉模型：这是工具的输出，而不是用户或者系统消息
          messages.push(
            new ToolMessage({
              tool_call_id: foundTool.id,
              content: toolResult,
            }),
          );
        }
      }
    } else {
      console.log(`\n✨ AI 最终回复:\n${response.content}\n`);
      return `${response.content}`;
    }
  }
  return messages[messages.length - 1].content;
}

// 创建一个实例
const case1 = `创建一个功能丰富的React ToTodoList 应用
1. 创建项目：pnpm create vite@latest react-todo-app -- --template react-ts
2. 修改 src/App.tsx，实现完整功能的 TodoList：
- 添加、删除、编辑、标记完成
- 分类筛选（全部/进行中/已完成）
- 统计信息显示
- localStorage 数据持久化
3. 添加复杂样式：
- 渐变背景（蓝到紫）
 - 卡片阴影、圆角
- 悬停效果
4. 添加动画
 - 添加/删除时的过渡动画
 - 使用 CSS transitions
5. 列出目录确认
注意：使用 pnpm，功能要完整，样式要美观，要有动画效果
之后在 react-todo-app 项目中：
1. 使用 pnpm install 安装依赖
2. 使用 pnpm run dev 启动服务器
`;
try {
  await runAgentWithTools(case1);
} catch (error) {
  console.log(error.message);
}
