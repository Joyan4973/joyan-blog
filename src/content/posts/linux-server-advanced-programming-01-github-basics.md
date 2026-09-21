---
title: "Linux 服务器高阶编程（1）：GitHub 基础"
published: 2026-09-13T00:00:00Z
updated: 2026-09-13T00:00:00Z
description: "整理 GitHub 仓库、分支、项目查找、仓库页面、本地 Git 配置和 SSH 设备认证相关内容。"
image: ""
tags:
  - Linux
  - GitHub
  - Git
  - SSH
  - 学习笔记
category: Linux 服务器高阶编程
draft: false
pinned: false
comment: true
readingTime: 4
lang: zh_CN
---

# GitHub 基础

## 一、基本概念

### 仓库

GitHub 保存一个独立项目的基本单位，可以存放：

- 源代码；
- 配置文件；
- 构建脚本；
- 项目文档；
- 与项目有关的其他资源。

一个 GitHub 账号可以创建多个仓库，通常一个仓库对应一个相对独立的项目。

### 分支

资源的存储单位

一个仓库可以包含多个分支，仓库会有一个默认分支

默认情况下，上传或查看的主要内容位于默认主分支master中

## 二、在 GitHub 中查找项目

### 使用关键词搜索

### 标签搜索

`sample`：示例、样例，用于查找某项技术的示例项目

`tutorial`：教程，用于查找某项技术的学习项目或教程

```text
socket sample
Python tutorial
```

## 三、仓库页面

### Code

用于查看项目资源，包括源代码、目录、配置文件、构建文件及项目文档等

### Issues

仓库中的问题交流和跟踪区域，用于提问和解决问题

### README.md

项目的自述文件，通常会自动展示在仓库主页

### LICENSE

LICENSE用于说明项目的授权方式和使用限制

MIT、Apache-2.0、GPL-3.0给使用者最大的使用权力，最小的限制

## 四、本地 Git 仓库与身份配置

### 创建本地仓库

1. 在电脑上创建一个准备存放项目的文件夹
2. 在该文件夹中单击右键，选择 Git Bash Here
3. 确认终端当前路径正是目标文件夹
4. 执行：

```bash
git init
```

出现了 (master)，表示当时位于本地 Git 仓库的master分支

### 查看 Git 配置

```bash
git config --list
```

该命令用于查看当前 Git 的配置信息user.name、user.email

### 配置全局用户名和邮箱

```bash
git config --global user.name "GitHub用户名"
git config --global user.email "注册邮箱"
```

设置完成后，再次执行：

```bash
git config --list
```

检查用户名和邮箱是否正确

## 五、SSH 设备认证

### 目的

本地电脑以后要与 GitHub 仓库传输数据，需要让 GitHub 确认当前设备是可信设备

### 测试是否已经认证

```bash
ssh -T git@github.com
```

### 生成 RSA 密钥

```bash
ssh-keygen -t rsa -C "注册邮箱"
```

Windows 默认通常保存在

```text
C:\Users\Windows用户名\.ssh\
```

主要生成两个文件：

- `id_rsa`：私钥，只能由本人保管，不能上传、公开或发送给别人。
- `id_rsa.pub`：公钥，可以添加到 GitHub。

### 将公钥添加到 GitHub

打开 id_rsa.pub，完整复制其中的公钥内容

在 GitHub 中进入头像菜单选择 Settings

在Key中粘贴完整公钥

添加完成后再次测试：

```bash
ssh -T git@github.com
```
