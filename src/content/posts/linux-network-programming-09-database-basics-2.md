---
title: "Linux 网络编程（9）：数据库基础 2"
published: 2026-07-28T15:06:47Z
updated: 2026-07-28T15:06:47Z
description: "Linux 网络编程课程第 9 课，整理 SQL 条件与模糊查询、分页、聚合与分组、排序去重，以及内连接、左连接和右连接等多表联查方法。"
image: ""
tags:
  - Linux
  - 数据库
  - MySQL
  - SQL
  - 数据查询
  - 多表联查
  - 课程笔记
category: Linux 网络编程
draft: false
pinned: false
comment: true
readingTime: 10
lang: zh_CN
---

# 数据库基础 2

本节继续学习 MySQL 数据查询，整理 `WHERE`、`LIKE` 和 `LIMIT` 的使用方法，并学习通过聚合函数、`GROUP BY`、`HAVING`、`ORDER BY` 与 `DISTINCT` 对查询结果进行统计和处理。

最后介绍多表联查，区分内连接、左连接和右连接的结果特点，并说明笛卡尔积及旧式连接写法可能带来的问题。

## 一、`WHERE` 条件

### 1. 条件的作用

基本形式：

```sql
SELECT 列名
FROM 表名
WHERE 条件;
```

### 2. 比较与逻辑运算

| 需求               | SQL 写法                      |
| ------------------ | ----------------------------- |
| 等于               | `列名 = 值`                   |
| 不等于             | `列名 != 值` 或 `列名 <> 值`  |
| 大于、小于         | `>`、`<`                      |
| 大于等于、小于等于 | `>=`、`<=`                    |
| 并且               | `条件1 AND 条件2`             |
| 或者               | `条件1 OR 条件2`              |
| 在闭区间内         | `列名 BETWEEN a AND b`        |
| 在指定集合中       | `列名 IN (值1, 值2, ...)`     |
| 不在指定集合中     | `列名 NOT IN (值1, 值2, ...)` |
| 为空               | `列名 IS NULL`                |
| 不为空             | `列名 IS NOT NULL`            |

代码示例：

```sql
-- 年龄不小于18岁，并且性别为女
SELECT *
FROM studentinfo
WHERE age >= 18 AND sex = '女';

-- 年龄在17到20之间，包含17和20
SELECT *
FROM studentinfo
WHERE age BETWEEN 17 AND 20;

-- 学号在给定集合中
SELECT *
FROM studentinfo
WHERE num IN (1, 3, 5, 10);
```

注意：

- `BETWEEN a AND b` 包含两端，相当于 `[a, b]`。
- `IN` 的括号里既可以写一组值，也可以放一个查询结果。
- 判断 `NULL` 不能写 `= NULL`，应写 `IS NULL` 或 `IS NOT NULL`。
- 不少数据库也支持 `!=`，而 SQL 标准的不等号写法是 `<>`。

## 二、模糊查询：`LIKE`

基本语法：

```sql
SELECT *
FROM 表名
WHERE 列名 LIKE '模糊表达式';
```

通配符：

| 通配符 | 含义                 | 示例                                      |
| ------ | -------------------- | ----------------------------------------- |
| `%`    | 匹配任意 0～多个字符 | `'张%'` 可匹配“张”“张三”“张二三”等        |
| `_`    | 匹配任意 1 个字符    | `'张_'` 可匹配“张三”“张1”等两个字符的结果 |

常见写法：

```sql
-- 姓名以“张”开头
SELECT * FROM studentinfo WHERE name LIKE '张%';

-- 姓名包含“张”
SELECT * FROM studentinfo WHERE name LIKE '%张%';

-- “张”后面必须恰好有一个字符
SELECT * FROM studentinfo WHERE name LIKE '张_';
```

`%` 可以匹配零个字符，而 `_` 必须匹配一个字符。

## 三、分页查询：`LIMIT`

MySQL 中常用：

```sql
SELECT *
FROM 表名
LIMIT a, b;
```

- `a`：从第几条之后开始取，即偏移量；
- `b`：本次最多取多少条；
- 偏移量从 `0` 开始。

示例代码：

```sql
SELECT *
FROM studentinfo
LIMIT 2, 3;
```

含义：跳过前 2 条，再取 3 条。

已知当前是第 `n` 页、每页显示 `m` 行：

```text
a = m × (n - 1)
b = m
```

例如每页 10 行，查询第 3 页：

```sql
SELECT *
FROM studentinfo
LIMIT 20, 10;
```

## 四、聚合函数

聚合函数将多行数据汇总成一个统计结果。

| 函数         | 作用     |
| ------------ | -------- |
| `COUNT(...)` | 计数     |
| `SUM(列名)`  | 求和     |
| `AVG(列名)`  | 求平均值 |
| `MAX(列名)`  | 求最大值 |
| `MIN(列名)`  | 求最小值 |

### 1. `COUNT(*)` 与 `COUNT(列名)`

示例代码：

```sql
SELECT COUNT(*) FROM studentinfo;
SELECT COUNT(name) FROM studentinfo;
SELECT COUNT(sex) FROM studentinfo;
```

- `COUNT(*)` 统计结果中的全部行；
- `COUNT(列名)` 只统计该列不为 `NULL` 的行。

因此，如果某些学生的 `sex` 是 `NULL`，`COUNT(sex)` 会小于 `COUNT(*)`。

### 2. 其他聚合函数示例

```sql
SELECT SUM(score) FROM sc;
SELECT AVG(score) FROM sc;
SELECT MAX(score) FROM sc;
SELECT MIN(score) FROM sc;

-- 查询03号课程的最低分
SELECT MIN(score)
FROM sc
WHERE C = '03';
```

## 五、分组：`GROUP BY` 与 `HAVING`

### 1. `GROUP BY`

`GROUP BY` 将指定列取值相同的行归为一组，常与聚合函数配合。

```sql
SELECT 分组列, 聚合函数(统计列)
FROM 表名
GROUP BY 分组列;
```

示例——查询每个学生的平均分：

```sql
SELECT S, AVG(score)
FROM sc
GROUP BY S;
```

示例——计算每个学生的总成绩：

```sql
SELECT S, SUM(score)
FROM sc
GROUP BY S;
```

### 2. `HAVING`

`HAVING` 用来筛选分组和聚合之后的结果。

```sql
-- 查询总成绩不低于200分的学生编号
SELECT S, SUM(score)
FROM sc
GROUP BY S
HAVING SUM(score) >= 200;
```

`WHERE` 与 `HAVING` 的区别：

```text
原始数据
   │
   ├─ WHERE：分组前筛选行
   ▼
GROUP BY：执行分组和聚合
   │
   ├─ HAVING：分组后筛选统计结果
   ▼
最终结果
```

## 六、排序与去重

### 1. `ORDER BY`

```sql
SELECT ...
FROM ...
ORDER BY 列名 ASC;   -- 升序

SELECT ...
FROM ...
ORDER BY 列名 DESC;  -- 降序
```

- `ASC`：升序；
- `DESC`：降序；
- 不写排序规则时，默认使用升序。

示例代码：

```sql
SELECT S, SUM(score)
FROM sc
GROUP BY S
ORDER BY SUM(score);

SELECT S, SUM(score)
FROM sc
GROUP BY S
ORDER BY SUM(score) DESC;
```

### 2. `DISTINCT`

`DISTINCT` 删除查询结果中的重复行：

```sql
SELECT DISTINCT S
FROM sc;
```

它只影响本次查询结果，不会删除表中的原始数据。若 `SELECT` 后有多列，数据库会把这些列组成的**整行**一起判断是否重复，而不是只对其中某一列独立去重。

## 七、多表联查

### 1. 内连接：`INNER JOIN`

内连接只保留两个表中能够按条件匹配成功的记录，可理解为取两表的交集。

```sql
SELECT *
FROM student
INNER JOIN sc
    ON sc.S = student.S;
```

连接三张表时继续追加 `JOIN ... ON ...`：

```sql
SELECT *
FROM 表1
INNER JOIN 表2 ON 连接条件
INNER JOIN 表3 ON 连接条件;
```

### 2. 左连接：`LEFT JOIN`

以左表为基准，左表所有行都会保留；右表没有匹配数据时，对应字段显示为 `NULL`。

```sql
SELECT *
FROM student
LEFT JOIN sc
    ON sc.S = student.S;
```

### 3. 右连接：`RIGHT JOIN`

以右表为基准，右表所有行都会保留；左表没有匹配数据时，对应字段显示为 `NULL`。

```sql
SELECT *
FROM student
RIGHT JOIN sc
    ON sc.S = student.S;
```

以下两条语句从保留数据的角度可以互相转换：

```sql
SELECT *
FROM student
LEFT JOIN sc ON sc.S = student.S;

SELECT *
FROM sc
RIGHT JOIN student ON sc.S = student.S;
```

### 4. 笛卡尔积与旧式连接写法

直接同时查询两张表而不写连接条件，会产生笛卡尔积：左表每一行与右表每一行全部组合。若两表分别有 `m`、`n` 行，结果有 `m × n` 行。

```sql
SELECT *
FROM student, sc;
```

加入关联条件后，查询结果可以与内连接一致：

```sql
SELECT *
FROM student, sc
WHERE sc.S = student.S;
```

笛卡尔积会先形成大量排列组合，再按条件筛选，因此不推荐这种写法；现代数据库可能会进行优化，但实际编写时仍应优先使用含义更明确的 `JOIN ... ON ...`。
