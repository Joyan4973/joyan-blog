---
title: "Linux 网络编程（8）：数据库基础 1"
published: 2026-07-27T15:48:54Z
updated: 2026-07-27T15:48:54Z
description: "Linux 网络编程系列第 8 篇，整理 MySQL 与 Workbench、数据库基本概念、关系数据库范式、建表约束以及 SQL 增删改查。"
image: ""
tags:
  - 数据库阶段
  - Linux
  - 数据库
  - MySQL
  - SQL
  - 数据库范式
  - DDL
  - CRUD
  - 学习笔记
category: Linux 网络编程
draft: false
pinned: false
comment: true
readingTime: 15
lang: zh_CN
---

# 数据库基础 1

本节开始学习数据库基础，首先区分 MySQL Server 与 MySQL Workbench 的职责，并整理数据库、表、字段、记录以及关系型与非关系型数据库等基本概念。

随后介绍第一范式、第二范式、第三范式和 BCNF，并通过 MySQL SQL 语句完成建表、修改表以及数据的增删改查。

## 一、MySQL 与 MySQL Workbench

### 1. 服务端与客户端

- **MySQL Server** 是真正保存和管理数据的数据库服务。
- **MySQL Workbench** 是连接 MySQL Server 的可视化客户端，用来编写、执行 SQL 和管理数据库。
- 在 Workbench 中连接 `Local instance MySQL57` 时，需要输入安装 MySQL 时设置的密码。
- 如果 Workbench 能正常连接，并能看到 `sys` 等系统库，说明数据库服务基本可用。

二者关系可以理解为：

```text
应用程序 / MySQL Workbench（客户端）
                 │
                 │ 发送 SQL
                 ▼
          MySQL Server（服务端）
                 │
                 ▼
             数据库与表
```

实际开发中，业务数据通常由程序通过数据库接口写入，不是依靠工作人员在 Workbench 中逐条录入。

### 2. 检查 MySQL 服务

如果 Workbench 无法连接，可在 Windows 的“计算机管理 → 服务”中检查 `MySQL57`：

- 服务必须处于运行状态；
- 可将启动类型设置为“自动”，让系统启动时自动运行数据库服务。

### 3. Workbench 常用功能

- 查看服务器状态；
- 查看客户端连接；
- 管理用户与权限；
- 导入、导出数据；
- 打开并执行 `.sql` 脚本；
- 在 `SCHEMAS` 区域查看数据库、表等对象。

## 二、数据库基本概念

### 1. 数据库的层次

```text
数据库（Schema）
└── 表（Table）
    ├── 列（Column / Field / 属性）
    └── 行（Row / Record / 元组）
```

- **数据库（Schema）**：组织一组相关数据表。
- **表**：以二维表形式保存同一类对象的数据。
- **列**：描述对象的某项属性，例如姓名、年龄。
- **行**：一条完整记录，也叫一个元组。

### 2. 关系型数据库与非关系型数据库

| 类型                    | 主要理解                                                     | 常见产品                  |
| ----------------------- | ------------------------------------------------------------ | ------------------------- |
| 关系型数据库            | 以二维表保存数据，表之间可以建立关系                         | MySQL、Oracle、SQL Server |
| 非关系型数据库（NoSQL） | 不以传统关系表作为唯一的数据组织方式；可以用“键—值”关系帮助理解 | Redis、MongoDB            |

补充理解：键值型只是 NoSQL 的一种。NoSQL 还包括文档型、列族型和图数据库等；MongoDB 属于文档型数据库。

## 三、数据库范式

### 1. 为什么需要范式

范式是设计关系表时应满足的一组约束。合理拆分表，可以让结构更清晰，并减少：

- 数据冗余；
- 更新异常；
- 插入异常；
- 删除异常。

范式之间具有逐级包含关系：

```text
BCNF ⊂ 第三范式（3NF）⊂ 第二范式（2NF）⊂ 第一范式（1NF）
```

也就是说，满足更高范式的关系，已经满足前面的低级范式。

### 2. 常见名词

- **属性**：表中的一列，也叫字段。
- **元组**：表中的一行。
- **码（候选码）**：能够唯一确定一个元组的最小属性集合；一张表可以有多个候选码。
- **主码（主键）**：从候选码中选出的一个，用来主要标识每一行。
- **主属性**：出现在任意候选码中的属性。
- **非主属性**：没有出现在任何候选码中的属性。
- **函数依赖 `X → Y`**：已知 `X` 的值就能唯一确定 `Y` 的值。

### 3. 第一范式（1NF）

第一范式要求每一列中的值都是不可再分的原子值，即同一个单元格中不要存放多个独立信息。

例如，“联系方式”一列中同时存放手机号和邮箱，会给查询和修改带来困难，宜拆成不同字段。

### 4. 第二范式（2NF）

在满足 1NF 的基础上，每个非主属性都必须**完全依赖**候选码，不能只依赖组合码的一部分。可概括为：**组合关键字不可拆**。

示例：

```text
选课（学号，姓名，年龄，课程名称，成绩，学分）
```

可能存在的函数依赖：

```text
（学号，课程名称）→（姓名，年龄，成绩，学分）
学号 →（姓名，年龄）
课程名称 → 学分
```

其中候选码是 `(学号, 课程名称)`，但：

- 姓名、年龄只依赖候选码中的“学号”；
- 学分只依赖候选码中的“课程名称”。

这属于对组合码的部分依赖，不满足 2NF，并会造成数据冗余、更新异常和插入异常。可拆分为：

```text
学生（学号，姓名，年龄）
课程（课程名称，学分）
选课（学号，课程名称，成绩）
```

### 5. 第三范式（3NF）

在满足 2NF 的基础上，非主属性不能通过另一个非主属性间接依赖于码，即避免：

```text
码 → 非主属性 A → 非主属性 B
```

示例：

```text
学生（学号，姓名，年龄，所在学院，学院地点，学院电话）
```

函数依赖：

```text
学号 →（姓名，年龄，所在学院）
所在学院 →（学院地点，学院电话）
```

“学院地点”和“学院电话”通过“所在学院”传递依赖于“学号”，因此可拆分为：

```text
学生（学号，姓名，年龄，所在学院）
学院（所在学院，学院地点，学院电话）
```

### 6. BCNF

不要让“关键字段决定关键字段”。更严格地说，在每个非平凡函数依赖 `X → Y` 中，决定因素 `X` 都必须是超码。

示例：

```text
仓库（仓库ID，存储物品ID，管理员ID，数量）
```

存在：

```text
（仓库ID，存储物品ID）→（管理员ID，数量）
（管理员ID，存储物品ID）→（仓库ID，数量）
```

将其拆分为：

```text
仓库管理（仓库ID，管理员ID）
仓库（仓库ID，存储物品ID，数量）
```

## 四、SQL 的执行与基本规则

### 1. 选择数据库

```sql
USE 20251018test;
```

`USE` 用来指定后续 SQL 默认操作的数据库。

### 2. Workbench 中执行 SQL

- 选中 SQL 后执行：只执行被选中的语句。
- 未选中时执行：从脚本开头或当前执行方式规定的位置运行，可能连续执行多条语句。
- 光标所在行执行：只执行当前行中的 SQL。
- SQL 语句一般以分号 `;` 结束。

## 五、创建表

### 1. 基本语法

```sql
CREATE TABLE 表名 (
    列名 数据类型 建表约束,
    列名 数据类型 建表约束,
    ...
);
```

### 2. 常见字符类型

| 类别               | 示例                                                |
| ------------------ | --------------------------------------------------- |
| 整数               | `TINYINT`、`SMALLINT`、`MEDIUMINT`、`INT`、`BIGINT` |
| 小数               | `FLOAT`、`DOUBLE`                                   |
| 日期与时间         | `DATE`、`DATETIME`、`TIME`、`YEAR`                  |
| 字符串             | `CHAR`、`NCHAR`、`VARCHAR`、`NVARCHAR`              |
| 长文本与结构化文本 | `TEXT`、`LONGTEXT`、`JSON`                          |
| 其他               | `BIT`、`BOOL`、`ENUM`、`SET` 等                     |

不常用的类型不要求一次全部记住；使用时再查其取值范围和语法。重点比较以下四种字符串类型：

| 类型          | 释义                            |
| ------------- | ------------------------------- |
| `CHAR(n)`     | 定长字符串，按固定长度保存      |
| `NCHAR(n)`    | 定长的国家字符集字符串          |
| `VARCHAR(n)`  | 变长字符串，最多保存 `n` 个字符 |
| `NVARCHAR(n)` | 变长的国家字符集字符串          |

理解重点：

- `CHAR` 是定长；内容不足规定长度时仍按定长处理。
- `VARCHAR` 是变长；按实际内容长度保存，更适合长度变化较大的文本。

> “国家字符集”可以用“一个字符占两个字节”帮助理解。
>
> 实际占用字节数还会受到数据库版本、字符集和具体字符的影响。
>
> 为什么说一个字符占两个字节？是因为早期中国制定了 GBK 等编码标准。在 GBK 编码中，**一个英文字符占 1 个字节，而一个汉字固定占 2 个字节**。
>
> 但是现如今无论是网页、Linux 系统，还是现代数据库，**绝对的主流编码是 UTF-8**。
>
> UTF-8 是一种**变长编码**，它为了兼容 ASCII 并节省空间，对不同字符分配了不同的字节数：
>
> - **英文字母、数字、半角标点**：占 **1 个字节**（与 ASCII 完全兼容）。
>
> - **大部分常用汉字**：占 **3 个字节**。
> - **生僻汉字、Emoji 表情、部分特殊符号**：占 **4 个字节**。
>
> 例如，在使用 `utf8mb3` 作为国家字符集的 MySQL 环境中，`NCHAR` 里的一个常用汉字通常占 3 个字节，而不是 2 个字节。

此外：

- `BIGINT`：较大范围的整数；
- `INT`：整数；
- `ENUM('男', '女')`：枚举值，只允许从给定值中选择。

### 3. 建表约束

| 约束             | 作用                                        |
| ---------------- | ------------------------------------------- |
| `PRIMARY KEY`    | 主键，唯一标识一行；不能重复、不能为 `NULL` |
| `UNIQUE`         | 要求该列的值唯一                            |
| `NOT NULL`       | 不允许该列为空                              |
| `DEFAULT`        | 未提供值时采用默认值                        |
| `AUTO_INCREMENT` | 整数列自动递增，常用于主键                  |

### 4. 建表示例

```sql
CREATE TABLE studentinfo (
    num BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(20) UNIQUE NOT NULL,
    sex ENUM('男', '女'),
    age INT DEFAULT 18
);
```

字段含义：

- `num`：学号，主键并自动递增；
- `name`：姓名，唯一且不能为空；
- `sex`：性别，只能填写“男”或“女”；
- `age`：年龄，未填写时默认为 18。

如果再次创建已经存在的表，会出现 `1050: Table already exists` 一类错误，应先确认表是否存在，或删除旧表后再创建。

## 六、修改表与删除表

### 1. 增加列

语法：

```sql
ALTER TABLE 表名 ADD COLUMN 列名 数据类型 建表约束;
```

示例代码：

```sql
ALTER TABLE studentinfo ADD COLUMN school INT;
```

### 2. 修改列的数据类型或约束

语法：

```sql
ALTER TABLE 表名 MODIFY 列名 数据类型 建表约束;
```

示例代码：

```sql
ALTER TABLE studentinfo MODIFY school VARCHAR(100);
```

### 3. 删除列

```sql
ALTER TABLE studentinfo DROP school;
```

### 4. 删除表

```sql
DROP TABLE studentinfo;
```

`DROP TABLE` 会删除表结构及其中的数据，执行前应确认目标表名。

## 七、数据的增删改查

### 1. 插入数据：`INSERT`

向所有列插入数据：

```sql
INSERT INTO studentinfo VALUES (1, '李四', '女', 19);
```

省略列名时，值的数量、顺序必须和表中列的定义一致。

只向指定列插入数据：

```sql
INSERT INTO studentinfo (age, name) VALUES (20, '张三');
```

此时：

- `num` 使用自增值；
- `sex` 未提供，可以为 `NULL`；
- 已明确提供的值要与列名顺序对应。

如果只填写年龄：

```sql
INSERT INTO studentinfo (age) VALUES (20);
```

会因为 `name` 设置了 `NOT NULL` 而失败。由此可见，省略某列的前提是该列允许为空、具有默认值，或能够自动生成。

### 2. 查询数据：`SELECT`

查询全部列：

```sql
SELECT * FROM studentinfo;
```

查询指定列：

```sql
SELECT name, num FROM studentinfo;
```

给查询结果中的列起别名：

```sql
SELECT name 姓名, num 学号 FROM studentinfo;
```

别名只改变查询结果的显示名称，不会修改表中真实的列名。

### 3. 更新数据：`UPDATE`

```sql
UPDATE studentinfo
SET age = 21
WHERE num = 1;
```

- `SET` 指定要修改的列和值；
- `WHERE` 指定修改哪些行。

### 4. 删除数据：`DELETE`

```sql
DELETE FROM studentinfo
WHERE num = 1;
```

`WHERE` 用来限制删除范围。

> 重要：`UPDATE` 或 `DELETE` 不写 `WHERE` 时，可能修改或删除表中的全部记录。

## 八、代码汇总

```sql
-- 1. 选择数据库
USE 20251018test;

-- 2. 创建表
CREATE TABLE studentinfo (
    num BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(20) UNIQUE NOT NULL,
    sex ENUM('男', '女'),
    age INT DEFAULT 18
);

-- 3. 修改表
ALTER TABLE studentinfo ADD COLUMN school INT;
ALTER TABLE studentinfo MODIFY school VARCHAR(100);
ALTER TABLE studentinfo DROP school;

-- 4. 插入数据
INSERT INTO studentinfo VALUES (1, '李四', '女', 19);
INSERT INTO studentinfo (age, name) VALUES (20, '张三');

-- 5. 查询数据
SELECT * FROM studentinfo;
SELECT name, num FROM studentinfo;
SELECT name 姓名, num 学号 FROM studentinfo;

-- 6. 更新数据
UPDATE studentinfo
SET age = 21
WHERE num = 1;

-- 7. 删除数据
DELETE FROM studentinfo
WHERE num = 1;

-- 8. 删除整张表
DROP TABLE studentinfo;
```
