import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// 数据库
const database = {
  users: {
    "001": { id: "001", name: "章三", email: "1111111@qq.com", role: "admin" },
    "002": { id: "002", name: "章四", email: "2222222@qq.com", role: "user" },
    "003": { id: "003", name: "章五", email: "3333333@qq.com", role: "user" },
  },
};

const server = new McpServer({
  name: "my-mcp-server",
  version: "1.0.0",
});

// 注册工具，查询用户信息
server.registerTool(
  "query_user",
  {
    description:
      "查询数据库中的用户信息，输入用户id,返回该用户的详细信息（姓名，邮箱，角色）",
    inputSchema: {
      userId: z.string().describe("用户ID"),
    },
  },
  async ({ userId }) => {
    const user = database.users[userId];
    if (!user) {
      return {
        content: [
          {
            type: "text",
            text: `用户 ID ${userId} 不存在。可用的 ID: 001, 002, 003`,
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: `用户信息：\n- ID: ${user.id}\n- 姓名: ${user.name}\n- 邮箱: ${user.email}\n- 角色: ${user.role}`,
        },
      ],
    };
  },
);

// 静态数据
server.registerResource(
  "使用指南",
  "docs://guide",
  {
    description: "mcp server使用指南",
    mimeType: "ext/plain",
  },
  async () => {
    return {
      contents: [
        {
          uri: "docs://guide",
          mimeType: "ext/plain",
          text: `MCP Server 使用指南,功能：提供用户查询等工具。使用：在 Cursor 等 MCP Client 中通过自然语言对话，Cursor 会自动调用相应工具`,
        },
      ],
    };
  },
);

// stdio的传输方式
const transport = new StdioServerTransport();
await server.connect(transport);
