---
title: "Linux 网络编程（10）：数据库语法 1"
published: 2026-07-29T10:07:30Z
updated: 2026-07-29T10:07:30Z
description: "Linux 网络编程系列第 10 篇，整理 MySQL 视图、自定义函数和变量，并介绍 IF、CASE 条件判断及 WHILE 循环的基本语法。"
image: ""
tags:
  - 数据库阶段
  - Linux
  - 数据库
  - MySQL
  - SQL
  - 视图
  - 自定义函数
  - 流程控制
  - 学习笔记
category: Linux 网络编程
draft: false
pinned: false
comment: true
readingTime: 13
lang: zh_CN
---

# 数据库语法 1

本节继续学习 MySQL，首先整理视图的创建、使用与删除，并通过自定义函数理解参数、返回值、局部变量和 `DELIMITER` 的作用。

随后区分局部变量、会话变量与系统变量，并通过判断正负数和累加求和的示例，学习 `IF`、`CASE` 与 `WHILE` 等流程控制语法。

## 一、视图

### 1. 什么是视图

视图是为了简化复杂的 `SELECT` 语句而产生的。

- 视图可以看成一张**虚拟表**。
- 它不是真实存储数据的表，而是由一条查询语句生成的查询结果。
- 视图中的数据来自原表。
- 视图当作表来查询，但不对其进行增加、修改和删除。
- 因为它是虚拟表，所以不需要像真实表一样考虑范式设计。

可以把它理解为：给一条经常使用的复杂查询起一个名字，以后直接查询这个名字。

### 2. 创建视图

基本语法：

```sql
CREATE VIEW 视图名 AS (
    SELECT语句
);
```

示例先连接 `student` 和 `sc`：

```sql
SELECT student.*, C, score
FROM student
INNER JOIN sc ON sc.S = student.S;
```

把查询结果保存为视图：

```sql
CREATE VIEW myview AS (
    SELECT student.*, C, score
    FROM student
    INNER JOIN sc ON sc.S = student.S
);
```

### 3. 创建视图时不能出现重复列名

连接 `student` 和 `sc` 时，两张表中都有学生编号列 `S`。

如果直接把两张表的所有列都放进视图，视图中就会出现两个同名的 `S` 列，而一张视图不能包含重复的列名。

### 4. 使用视图

视图创建完成后，可以像查询普通表一样查询：

```sql
SELECT * FROM myview;
```

虽然写法变短了，但数据库仍然会执行创建该视图时保存的原查询。

### 5. 删除视图

```sql
DROP VIEW IF EXISTS myview;
```

`IF EXISTS` 表示：

- 视图存在就删除；
- 视图不存在时只给出警告，不会因为报错而中断后续脚本。

这类写法常用于需要重复执行的 SQL 脚本。

### 6. 视图的优缺点

#### 优点

- 简化复杂 SQL，使用时语句更短。
- 相同的复杂查询可以重复使用。
- 在客户端、服务器和数据库通过网络连接的实际场景中，传输较短的语句可以节省一定流量。
- 对外暴露的信息更少，相对更安全。

#### 缺点

- **不会提高原查询的执行效率。**
- 查询视图时，数据库仍然需要执行创建视图时使用的原 SQL。
- 视图主要简化写法，不等于把查询结果提前计算并永久保存。

## 二、自定义函数

### 1. 自定义函数的作用

MySQL 已经提供了聚合函数等内置函数，也允许程序员根据自己的需求创建函数。

自定义函数与 C/C++ 函数的基本思想相似：

- 可以接收参数；
- 函数内部可以定义变量并进行计算；
- 最后通过 `RETURN` 返回一个值。

### 2. 创建函数的基本语法

```sql
DELIMITER //

CREATE FUNCTION 函数名(变量名 数据类型, 变量名 数据类型, ...)
RETURNS 返回值类型
BEGIN
    函数体;
    函数体;
    RETURN 返回值;
END //

DELIMITER ;
```

关键部分：

- `CREATE FUNCTION`：创建函数。
- 参数列表：写在函数名后面的圆括号中，每个参数都要写参数名和数据类型。
- `RETURNS`：声明返回值的数据类型。
- `BEGIN ... END`：函数体。
- `RETURN`：返回函数的计算结果。

### 3. 为什么要使用 DELIMITER

MySQL 默认把分号 `;` 当作一条 SQL 的结束标志。

但是函数体中会出现多条带分号的语句。为了避免 MySQL 在函数尚未写完时就提前结束创建，需要先临时更换结束符：

```sql
DELIMITER //
```

函数使用 `END //` 结束后，再恢复默认分号：

```sql
DELIMITER ;
```

注意：`DELIMITER` 只是修改客户端识别整条语句结束位置的规则，不是函数内部的业务代码。

### 4. 加法函数示例

先让函数计算 `a + b`，调用 `myadd(3, 5)` 得到 `8`；随后又把计算式改成 `a + b + 100`，结果变成 `108`。

最终代码：

```sql
DELIMITER //

CREATE FUNCTION myadd(a INT, b INT)
RETURNS INT
BEGIN
    DECLARE c INT DEFAULT 0;
    SET c = a + b + 100;
    RETURN c;
END //

DELIMITER ;

SELECT myadd(3, 5);
```

代码说明：

- `a`、`b` 是函数参数。
- `DECLARE c INT DEFAULT 0;` 定义一个初始值为 `0` 的整型局部变量。
- `SET` 用于给变量赋值。
- `RETURN c;` 返回计算结果。

### 5. 调用与删除函数

调用函数：

```sql
SELECT 函数名(参数列表);
```

删除函数：

```sql
DROP FUNCTION IF EXISTS 函数名;
```

经常先写：

```sql
DROP FUNCTION IF EXISTS myfun;
```

这样重复执行脚本时，可以先删除旧函数，再重新创建，避免“函数已经存在”的错误。

MySQL 没有直接修改函数体的常用写法，因此采用“先删除，再创建”的方式更新函数。

## 三、MySQL 中的变量

分成三类：

| 类型     | 写法       | 生命周期与特点                                   |
| -------- | ---------- | ------------------------------------------------ |
| 局部变量 | 普通变量名 | 在函数等程序块内部声明，只在当前程序块中使用     |
| 会话变量 | `@变量名`  | 只在当前数据库连接中有效                         |
| 系统变量 | `@@变量名` | 由数据库系统提供，影响数据库服务的配置或运行行为 |

### 1. 局部变量

局部变量使用 `DECLARE` 声明：

```sql
DECLARE c INT DEFAULT 0;
```

- `c`：变量名；
- `INT`：数据类型；
- `DEFAULT 0`：默认值为 `0`。

局部变量从声明位置开始生效，到所在的 `BEGIN ... END` 代码块结束。

赋值使用：

```sql
SET c = a + b;
```

### 2. 会话变量

会话变量以一个 `@` 开头：

```sql
SET @x = 10;
SELECT @x;
```

它只在当前数据库连接中有效。

在一个连接里设置 `@x` 后可以查询到 `10`；换到另一个连接执行 `SELECT @x;`，结果为 `NULL`。这说明不同连接拥有各自独立的会话变量。

### 3. 系统变量

系统变量以两个 `@` 开头：

```sql
SELECT @@date_format;
```

查看全局变量：

```sql
SHOW GLOBAL VARIABLES;
```

系统变量的赋值形式：

```sql
SET @@auto_increment_increment = 值;
```

系统变量由 MySQL 提供，用户不能随意创建新的系统变量，只能在权限和规则允许的情况下查询或修改已有变量。

## 四、IF 条件判断

### 1. 基本语法

```sql
IF (表达式1) THEN
    执行语句;
ELSEIF (表达式2) THEN
    执行语句;
ELSEIF (表达式3) THEN
    执行语句;
ELSE
    执行语句;
END IF;
```

注意：

- MySQL 中写作 `ELSEIF`，中间没有空格。
- `ELSEIF` 和 `ELSE` 都可以根据实际需要省略。
- 整个判断结构必须以 `END IF;` 结束。

### 2. 判断正数、负数和零

```sql
DROP FUNCTION IF EXISTS myfun;

DELIMITER //

CREATE FUNCTION myfun(n INT)
RETURNS VARCHAR(10)
BEGIN
    DECLARE res VARCHAR(10) DEFAULT '';

    IF (n = 0) THEN
        SET res = '零';
    ELSEIF (n > 0) THEN
        SET res = '正数';
    ELSE
        SET res = '负数';
    END IF;

    RETURN res;
END //

DELIMITER ;

SELECT myfun(0);
```

执行 `SELECT myfun(0);`，结果为：

```text
零
```

程序会按顺序判断条件，一旦某个条件成立，就执行对应分支。

## 五、CASE 条件判断

### 1. 简单 CASE

适合把同一个变量与多个固定值进行比较：

```sql
CASE 变量
    WHEN 值1 THEN 执行语句;
    WHEN 值2 THEN 执行语句;
    WHEN 值3 THEN 执行语句;
END CASE;
```

### 2. 搜索 CASE

每个 `WHEN` 后面都可以写一个完整的条件表达式：

```sql
CASE
    WHEN (表达式1) THEN 执行语句;
    WHEN (表达式2) THEN 执行语句;
    WHEN (表达式3) THEN 执行语句;
END CASE;
```

### 3. 使用 CASE 改写正负数判断

```sql
DROP FUNCTION IF EXISTS myfun;

DELIMITER //

CREATE FUNCTION myfun(n INT)
RETURNS VARCHAR(10)
BEGIN
    DECLARE res VARCHAR(10) DEFAULT '';

    CASE
        WHEN (n = 0) THEN SET res = '零';
        WHEN (n > 0) THEN SET res = '正数';
        WHEN (n < 0) THEN SET res = '负数';
    END CASE;

    RETURN res;
END //

DELIMITER ;

SELECT myfun(-10);
```

结果为：

```text
负数
```

### 4. IF 与 CASE 的选择

- 分支较少、条件逻辑比较灵活时，可以使用 `IF`。
- 针对一个变量的多个取值进行分支时，简单 `CASE` 更直观。
- 每个分支都需要独立条件表达式时，可以使用搜索 `CASE`。

## 六、WHILE 循环

### 1. 基本语法

```sql
WHILE 循环条件
DO
    循环体;
END WHILE;
```

执行过程：

1. 先判断循环条件；
2. 条件成立就执行循环体；
3. 执行完成后再次判断条件；
4. 条件不成立时退出循环。

MySQL 中没有 `FOR` 循环写法，还可以使用 `LOOP` 和 `REPEAT` 循环。

### 2. 计算 1 + 2 + 3 + … + n

```sql
DROP FUNCTION IF EXISTS mysum;

DELIMITER //

CREATE FUNCTION mysum(n INT)
RETURNS INT
BEGIN
    DECLARE res INT DEFAULT 0;
    DECLARE i INT DEFAULT 1;

    WHILE i <= n
    DO
        SET res = res + i;
        SET i = i + 1;
    END WHILE;

    RETURN res;
END //

DELIMITER ;

SELECT mysum(10);
```

执行结果：

```text
55
```

变量变化过程：

- `res` 用于保存累加结果；
- `i` 从 `1` 开始；
- 每轮把 `i` 加到 `res` 中；
- 然后执行 `i = i + 1`；
- 当 `i > n` 时退出循环。
