import { spawn } from "child_process";
// const command = "ls -la";
const command =
  'echo -e "n\nn" | npm create vite react-todo-app --template react-ts';
const cwd = process.cwd();

// spawn 可以指定在 cwd 这个目录下执行命令，会创建一个子进程来跑
// 解析命令和参数
const [cmd, ...args] = command.split(" ");

// 创建子进程执行命令
const child = spawn(cmd, args, {
  cwd,
  stdio: "inherit", // 继承父进程的输入输出,输出到控制台
  shell: true, // 使用 shell 解析命令
});

let errMessage = "";

child.on("error", (err) => {
  errMessage = err.message;
});

child.on("close", (code) => {
  if (code === 0) {
    console.log("命令执行成功");
    process.exit(0);
  } else {
    console.error(`命令执行失败，退出码: ${code}`);
    if (errMessage) {
      console.error(`错误信息: ${errMessage}`);
    }
    process.exit(code || 1);
  }
});
