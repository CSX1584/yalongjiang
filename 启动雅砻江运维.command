#!/bin/bash

set -Eeuo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
MIN_NODE_MAJOR=18

green='\033[0;32m'
yellow='\033[0;33m'
red='\033[0;31m'
reset='\033[0m'

pause_after_error() {
  local exit_code=$?

  if [[ $exit_code -ne 0 && $exit_code -ne 130 ]]; then
    printf "\n%b启动失败（错误码 %s）。%b\n" "$red" "$exit_code" "$reset"
    read -r -p "按回车键关闭窗口…" _
  fi
}

trap pause_after_error EXIT

printf '\033]0;雅砻江运维 OPS\007'
cd "$PROJECT_DIR"

printf "%b雅砻江运维 OPS 启动器%b\n" "$green" "$reset"
printf "项目目录：%s\n\n" "$PROJECT_DIR"

# Finder 双击 .command 时的 PATH 通常比交互式终端短。
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if ! command -v node >/dev/null 2>&1; then
  launcher_nvm_dir="${NVM_DIR:-$HOME/.nvm}"
  if [[ -s "$launcher_nvm_dir/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    source "$launcher_nvm_dir/nvm.sh"
  fi
fi

install_node_with_homebrew() {
  local brew_command=''

  if command -v brew >/dev/null 2>&1; then
    brew_command="$(command -v brew)"
  elif [[ -x /opt/homebrew/bin/brew ]]; then
    brew_command='/opt/homebrew/bin/brew'
  elif [[ -x /usr/local/bin/brew ]]; then
    brew_command='/usr/local/bin/brew'
  fi

  if [[ -z "$brew_command" ]]; then
    printf "%b未检测到 Node.js。%b\n" "$red" "$reset"
    printf "请先从 https://nodejs.org/ 安装 Node.js %s 或更高版本，再重新双击本启动器。\n" "$MIN_NODE_MAJOR"
    return 1
  fi

  printf "%b未检测到可用的 Node.js，正在通过 Homebrew 安装…%b\n" "$yellow" "$reset"
  "$brew_command" install node
  export PATH="$($brew_command --prefix)/bin:$PATH"
  hash -r
}

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  install_node_with_homebrew
fi

node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
if (( node_major < MIN_NODE_MAJOR )); then
  printf "%b当前 Node.js 版本过低：%s（项目需要 %s+）。%b\n" "$yellow" "$(node --version)" "$MIN_NODE_MAJOR" "$reset"

  if command -v brew >/dev/null 2>&1; then
    printf "正在通过 Homebrew 更新 Node.js…\n"
    brew upgrade node || brew install node
    export PATH="$(brew --prefix)/bin:$PATH"
    hash -r
  else
    printf "%b请升级 Node.js 后重试：https://nodejs.org/%b\n" "$red" "$reset"
    exit 1
  fi
fi

needs_install=false

if [[ ! -d node_modules || ! -x node_modules/.bin/vite ]]; then
  needs_install=true
elif [[ package-lock.json -nt node_modules/.package-lock.json ]]; then
  needs_install=true
elif ! npm ls --depth=0 --silent >/dev/null 2>&1; then
  needs_install=true
fi

if [[ "$needs_install" == true ]]; then
  printf "%b检测到依赖缺失或已更新，正在自动安装…%b\n" "$yellow" "$reset"
  npm install --no-audit --no-fund
  printf "%b依赖安装完成。%b\n\n" "$green" "$reset"
else
  printf "%b依赖检查通过。%b\n\n" "$green" "$reset"
fi

printf "正在启动开发服务器，浏览器将自动打开…\n"
printf "停止服务请按 Control + C。\n\n"

npm run dev -- --host 127.0.0.1 --open
