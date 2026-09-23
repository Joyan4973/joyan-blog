---
title: "Linux 服务器高阶编程（4）：POSIX 正则函数与 mmap 文件匹配"
published: 2026-09-20T00:00:00Z
updated: 2026-09-20T00:00:00Z
description: "整理 POSIX 正则函数的编译、执行与错误处理，父子表达式和匹配位置，并结合 mmap 与邮箱规则完成文本匹配。"
image: ""
tags:
  - Linux
  - 正则表达式
  - POSIX
  - mmap
  - grep
  - 学习笔记
category: Linux 服务器高阶编程
draft: false
pinned: false
comment: true
readingTime: 8
lang: zh_CN
---

# Linux 服务器高阶编程（4）：POSIX 正则函数与 mmap 文件匹配

## 一、在 C 程序中使用正则

使用 POSIX 正则函数需要包含头文件：

```c
#include <regex.h>
```

### `regex_t`：正则类型

```c
regex_t reg;
```

### `regcomp()`：编译正则表达式

把 `regstr` 转换为可供正则函数使用的类型，并保存到 `reg` 中

```c
regcomp(&reg, regstr, 0);
```

- `&reg`：接收编译结果的 `regex_t` 变量地址
- `regstr`：字符串形式的正则表达式
- `0`：使用默认编译选项

### `regfree()`：释放正则类型

`regcomp()` 生成的正则类型内部会使用资源，使用完成后要释放，避免内存泄漏

```c
regfree(&reg);
```

### `regerror()`：取得正则错误信息

用来取得正则错误信息，并把错误文本保存到用户提供的字符缓冲区中

- 检查正则表达式的语法
- 在表达式异常时取得错误描述
- 便于定位复杂表达式的问题

### `regexec()`：执行匹配

```c
regexec(&reg, data, regnum, match, 0);
```

参数含义：

- `&reg`：已经由 `regcomp()` 生成的正则类型
- `data`：数据源，也就是从中查找结果的目标数据
- `regnum`：表达式数量
- `match`：传出匹配位置的 `regmatch_t` 数组
- `0`：默认匹配选项

返回值：

- 返回 `0`：匹配成功
- 返回 `REG_NOMATCH`：没有匹配到结果

与 `grep` 一次遍历并显示多条结果不同，老师强调 `regexec()` 每调用一次只返回一条结果。若数据中存在多条记录，程序需要循环调用。

## 二、数据源可以来自哪里

正则函数匹配的是进程能够访问的数据，并不局限于某一种输入形式

1. 文件数据：先 `open()` 打开文件，再用 `read()` 把内容读入缓冲区
2. 标准输入：用户运行程序后从 `stdin` 输入的数据
3. 程序参数：执行程序时通过命令行传入的数据
4. 内存数据：程序已经保存在某段内存中的数据

`main()` 的两个参数

```bash
./app ad 20 8
```

```c
int main(int argc, char** argv)
```

此时：

```text
argc    = 4
argv[0] = "./app"
argv[1] = "ad"
argv[2] = "20"
argv[3] = "8"
```

程序路径 `./app` 本身也算一个参数。只要进程能够访问这些字符串，就可以把它们作为正则匹配的数据源

## 三、表达式数量与父、子表达式

### 为什么需要子表达式

假设要从下面的文本中得到人名

```html
<name>刘备</name>
```

外层 `<name>...</name>` 是定位数据所必需的规则，但真正需要提取的是中间的“刘备”，因此要把关键内容写成子表达式

```text
<name>\([^<]\+\?\)</name>
```

这里：

- 整个表达式负责定位完整的 `<name>` 标签
- 圆括号中的表达式负责捕获标签正文
- `[^<]` 限制正文不能跨入下一个标签

### 表达式数量的计算

```text
表达式数量 = 子表达式数量 + 1
```

多出来的 `1` 是整个父表达式本身

例如：

- 只捕获一个 `<name>` 标签正文：父表达式 1 个、子表达式 1 个，`regnum = 2`。
- 同时捕获姓名与地址：父表达式 1 个、子表达式 2 个，`regnum = 3`。

### HTML 超链接示例

```html
<a href="https://www.baidu.com">点击访问百度</a>
```

若既要提取 `href` 中的地址，又要提取标签正文，就需要两个子表达式。加上完整的 `<a>...</a>` 父表达式，表达式总数为 3

## 四、`regmatch_t` 与匹配位置

`regexec()` 不会直接把目标文本复制到新字符串中，而是通过 `regmatch_t` 数组告诉程序“结果位于数据源的什么位置”

```c
regmatch_t match[regnum];
```

每个 `regmatch_t` 元素保存两个关键偏移

- `rm_so`：匹配结果的起始位置
- `rm_eo`：匹配结果的末尾位置

数组各元素的含义

- `match[0]`：父表达式，也就是完整匹配结果的位置
- `match[1]`：第一个子表达式的位置
- `match[2]`：第二个子表达式的位置
- 后续元素依次对应后续子表达式

因此，数组长度等于表达式数量；每个元素又能保存起始与末尾两个位置

例如

```c
snprintf(name,
         match[1].rm_eo - match[1].rm_so + 1,
         "%s",
         data + match[1].rm_so);
```

理解这一行：

1. `match[1].rm_so` 是姓名子表达式的起点。
2. `match[1].rm_eo - match[1].rm_so` 是姓名长度。
3. `data + match[1].rm_so` 把数据源指针移动到姓名起始位置。
4. 长度再加 `1`，为字符串末尾的 `\0` 留出位置。

## 五、用 `mmap` 快速取得文件内容

把整个小文件映射到进程内存中，随后直接把映射地址作为正则匹配的数据源

基本步骤：

1. `open()` 打开文件
2. `lseek()` 移动到文件末尾并取得文件大小
3. `mmap()` 建立映射
4. 映射成功后，指针指向的内存就包含文件数据
5. 文件描述符不再需要时调用 `close()`
6. 使用结束后调用 `munmap()` 解除映射

示例

```c
int fd = open("a.html", O_RDWR);
int fsize = lseek(fd, 0, SEEK_END);

char* mmap_ptr = NULL;
mmap_ptr = mmap(NULL,
                fsize,
                PROT_READ | PROT_WRITE,
                MAP_PRIVATE,
                fd,
                0);
close(fd);
```

参数含义：

- `NULL`：由系统选择映射地址。
- `fsize`：映射长度等于文件大小。
- `PROT_READ | PROT_WRITE`：映射区可读、可写。
- `MAP_PRIVATE`：建立私有映射。
- `fd`：被映射文件的描述符。
- `0`：从文件起始位置开始映射。

循环匹配时会不断移动 `mmap_ptr`，因此要先保存原始映射地址，最后才能正确解除映射

```c
char* copy_ptr = mmap_ptr;
```

## 六、邮箱匹配练习

```text
1iu88777@gmail.com
627839123@qq.com
123@qq.com
ludya^_^@163.com
doiuw78912@163.com
nmvia87672@gmail.net
890821323@qq.cn
889iuancs89218973891ycniakjnbsxzc89y1892y3@gmail.com
```

限定条件

- 用户名长度为 8～15 个字符
- 用户名由大小写字母、数字或下划线组成
- 企业名由大小写字母或数字组成
- 后缀只接受 `.com` 或 `.cn`
- 必须从行首匹配到行尾，不能只截取一行中的局部内容

```bash
grep '^[a-zA-Z0-9_]\{8,15\}@[a-zA-Z0-9]\+\.\(com\|cn\)$' b.c
```
