---
title: "C 语言学习笔记：从基础语法到文件操作"
published: 2026-07-15T00:00:00Z
updated: 2026-07-15T00:00:00Z
description: "系统整理 C 语言基础语法、数据类型、流程控制、指针、数组、函数、内存管理、字符串、结构体、链表与文件操作等核心知识。"
image: ""
tags:
  - C
  - C 语言
  - 程序设计
  - 基础语法
  - 指针
  - 数据结构
  - 课程笔记
category: C 语言
draft: false
pinned: false
comment: true
readingTime: 90
lang: zh_CN
---

# C 语言学习笔记：从基础语法到文件操作

这篇笔记系统整理 C 语言从入门到常用数据结构与文件操作的核心知识，涵盖基础语法、输入输出、流程控制、指针、数组、函数、内存管理、字符串、结构体、链表等内容。

文中的部分示例以 Windows 和 Visual Studio 开发环境为基础；涉及平台相关的头文件、函数和数据类型大小时，应以实际编译器与目标架构为准。

## C 与 C++ 的区别

C 语言以面向过程的程序设计为主，侧重具体功能和算法的实现，常用“数据结构 + 算法 = 程序”来概括其核心思路。

C++ 在兼容大部分 C 语言语法的基础上，引入了面向对象、泛型编程等机制，更侧重程序架构与抽象设计，适合构建规模更大、结构更复杂的软件项目。

## 常用配置与函数

### 关闭安全提示

```c
#define _CRT_SECURE_NO_WARNINGS
```

### 数学函数

```c
#include <math.h>
pow(n,3);//n的3次方
sqrt(25);//25的平方根
fabs(-3);//绝对值
ceil(2.001);//向上取整，结果为3
floor(2.999);//向下取整，结果为2
```

### 随机数

```c
#include<stdio.h>
#include<stdlib.h>
int main()
{
	int n = rand();
	printf("%d\n", n);
	return 0;
}
```

通过这种方式可以获取随机数，但是多试几次就会发现，总是生成一个相同的数字，所以这是个伪随机数

可以通过在生成随机数之前设置种子数来让随机数变得随机，不再是那个相同的数

```c
srand(21);
```

但是，设置完后发现，数是变了，但是还是生成重复的相同的数，所以我们要让种子数通过时间来永恒变化

```c
#include<stdio.h>
#include<stdlib.h>
#include<time.h>
int main()
{
	time_t t;
	t = time(NULL);
	printf("%lld\n", t);//这个数字是1970年至今的秒数
	srand(t);
	int n = rand();
	printf("%d\n", n);
	return 0;
}
```

假设你要从1-31里随机一个数的话，你需要

```c
printf("%d", rand() % 31 + 1);
```

### 清空键盘缓冲区

```c
setvbuf(stdin, NULL, 0, 100);
```

## 入门与开发环境

### 基本程序框架

```c
#include <stdio.h>
int main1()
{
	printf("hello world\n\n\n");


	return 0;
}
```

### main函数的唯一性

main函数或称主函数是C语言开发的软件项目必须有的一个入口模块

注意：main函数不能重复定义，所以此处代表本程序有另一个执行入口main，所以此处使用main1

### 快捷键

#### 开始执行（不调试）

ctrl+F5

#### 替换

ctrl+h

#### 调取提示

ctrl+j

#### 转到定义

ctrl+左键

## printf 格式化输出

```c
#include<stdio.h>
int main()
{
    //printf(3 + 5);错！
	printf("12345679 * 9 = %d \n", 12345679 * 9);
	printf("12345679 * 18 = %d \n", 12345679 * 18);

	return 0;
}
```

### 格式占位符的写法

类似%d的用法

（ [] 代表可选项）

书写标准：%[补充位标志] [数据文字的宽度] [能四舍五入的小数后位数例如：<.2>] [length] 数字类型符号

```c
#include<stdio.h>
int main()
{
	printf("北京时间：%d:%i", 11, 8);//代表d和i均能代表整数
	printf("北京时间：%02d:%02i", 11, 8);//0代表不足位数时补0，2代表数据文字的宽度

	return 0;
}
```

注意：数据文字宽度仅限制不足该数时，用前面的补充位标志补齐，超过所设定的数据文字宽度也可以，不报错

```c
//示例
#include<stdio.h>
int main()
{
	printf("%7d*%-7.1f=%.1f\n", 3, 0.7, 3 * 0.7);
	printf("%7.1f*%-7.1f=%.2f\n", 3.3, 6.7, 3.3 * 6.7);
	printf("%7.2f*%-7.1f=%.3f\n",3.33,66.7,3.33*66.7);
	printf("%7.3f*%-7.1f=%.4f\n",3.333,666.7,3.333*666.7);
	printf("%7.4f*%-7.1f=%.5f\n",3.3333,6666.7,3.3333*6666.7);
	printf("%7.5f*%-7.1f=%.6f\n", 3.33333, 66666.7, 3.33333 * 66666.7);


	return 0;
}
```

%f默认打印六位小数

补充位标志中减号“-”代表左对齐

## 基本数据类型

数据类型分为：基本类型（int float double char）指针类型、扩展类型（数组、enum、struct、union）

char占一字节，short占两字节，int占四字节，long占四字节，longlong占八字节（有无符号型整数所占字节相同）

单精度float小数点后7位，占四字节，双精度double小数点后15位，占八字节

```c
#define _CRT_SECURE_NO_WARNINGS
#include<stdio.h>
int main()
{
	int n = 9;
	printf("signed int 字节数 %d %d %d\n", sizeof(int), sizeof(n), sizeof(9));
	unsigned int m = 9U;
	printf("unsigned int 字节数 %d %d %d\n", sizeof(unsigned int), sizeof(m), sizeof(9U));
	long p = 9L;
	printf("signed long int 字节数 %d %d %d\n", sizeof(long), sizeof(p), sizeof(9L));
	unsigned long q = 9UL;
	printf("unsigned long int 字节数 %d %d %d\n", sizeof(long), sizeof(q), sizeof(9UL));
	long long r = 9LL;
	printf("signed long long int 字节数 %d %d %d\n", sizeof(long long), sizeof(r), sizeof(9LL));
	unsigned long long s = 9ULL;
	printf("unsigned long long int 字节数 %d %d %d\n", sizeof(unsigned long long), sizeof(s), sizeof(9ULL));
	short t = 9;//没有后缀
	printf("signed short int 字节数 %d %d %d\n", sizeof(short), sizeof(s), sizeof(9));
	unsigned short u = 9u;
	printf("unsigned short int 字节数 %d %d %d\n", sizeof(unsigned short), sizeof(u), sizeof(9u));
	char v = 'A';
	printf("signed char 字节数 %d %d %d\n", sizeof(signed char), sizeof(v), sizeof('A'));
	unsigned char w = 48u;
	printf("unsigned signed char 字节数 %d %d\n", sizeof(unsigned char), sizeof(w));
	return 0;
}
```

注意：sizeof是个运算符，并不是函数，能够计算出表达式或数据类型在当前系统编译器下所占的内存字节数

命名要求的语法规则：只能包含字母、数字、下划线、美元符号，其中数字不能作为首字母，且不能使用编程语言的保留字（专有名词）

命名要求的开发规范：小驼峰、大驼峰（例如西安，小驼峰xiAn，大驼峰XiAn）

### 计算机存储基本概念

字节是最小的存储单位，1Byte（字节）=8bit（比特，位）

1024B=1KB，1024KB=1MB，GB、TB、PB也依次按照1024换算

### 进制

十进制转二进制：整数除2取余，小数乘2取整

其他进制打印方法

```c
//没有直接打印二进制的方式
printf("八进制：%o\n",185);
printf("十六进制：%x\n",185);
```

C语言中，二进制以0B开头，八进制以0开头，十六进制以0X开头

### 内存存储原理：原码、反码、补码

第一位均表示符号，正数都一样，负数反码全取反，补码取反+1

```c
char aa = -16;
char bb = -5;
char cc = aa + bb;
printf("%d %u\n", cc, cc);//-21 4294967275
printf("%hhd %hhu\n", cc, cc);//-21 235
```

%d代表四个字节长度的有符号十进制，%u代表四个字节长度的无符号

hh代表char，即将正常的四个字节长度改为一字节长度

例子中，-21的补码为11101011，有符号的都正常显示了-21，而无符号的一字节长度将符号位的1视为数值，计算出十进制数值为235

而无符号的四字节长度，本身-21作为char只占一字节，打印时补齐了前三个字节，即都补11111111，计算出得4294967275

#### 例题

```c
char m = -1;
unsigned char n = -1;
printf("%hhd %hhd", m / 2, n / 2);//0 127
```

解释

-1在这里其实是作为整型存在的，即四字节

也就是说两个char类型因为是一字节的，其实是读取了四字节的-1的最后一个字节，那么char读取的是-1，unsigned char读取的是255

分别对其/2，也就是0 127

由此得出不能光看数值，要看存储的方式和类型

```c
unsigned short n = -1;
printf("%hu %hd %hd\n", n, n / 2, n / 2 + 1);
```

通过这样的方式可以看出short的三个边界值

所以，例如short a=32767，a++之后，a的值为-32768，并不是32768，我们把整数增加反而变小的现象称为溢出现象

当然，也可以利用limits.h头文件中定义好的最大值和最小值获取边界值

```c
#include<stdio.h>
#include<limits.h>
int main()
{
	printf("char 最大值：%hhd 最小值：%hhd\n", CHAR_MAX, CHAR_MIN);
	printf("unsigned char 最大值：%hhu 最小值：%hhu\n", 0, UCHAR_MAX);
	//一些特殊的写法：SHRT_MAX LLONG_MAX

	return 0;
}
```

### 浮点

定点存储（整型、字符型）使用的是符号位+原码、反码、补码，而浮点存储使用的是符号位+指数区+尾数区

#### 浮点数的乘除法

```c
#define _CRT_SECURE_NO_WARNINGS
#include <stdio.h>
int main()
{
	double r;
	double PI = 3.14;
	printf("输入球体半径\n");
	scanf("%lf", &r);
	double v = 4. / 3 * PI * r * r * r ;
	double s = 4 * PI * r * r;
	printf("该球体的体积为%.2f，表面积为%.2f\n",v,s);

	return 0;
}
```

这部分使用了4.来实现调用浮点数除法

#### 浮点数的打印

```c
#include<stdio.h>
int main()
{
	float f = .25f;
	double d = .25;
	long double ld = .25l;
	printf("字节数：%d %d %d\n",sizeof(float),sizeof(double),sizeof(long double));
	float pi = 3.1415926f;
	double pi2 = 3.1415926;
	float dis = 1.08e9f;
	printf("小数形式：%f %f\n", pi, dis);
	printf("指数形式：%e %e\n", pi, dis);
	printf("最短形式：%g %g\n", pi, dis);
	return 0;
}
```

以上呈现的是浮点数多种打印方式，最推荐%g

### 类型转换

```c
//自动类型转换
printf("%d\n", sizeof(9u + 8ull + 0176 - 1578));//8
printf("%d\n", sizeof(9u + 8ull + 0176 - 1578.f));//4，float等级在这里是最高的，所以按照float的字节数输出
printf("%d\n", sizeof(9u + 8ull + 0176 - 1578.f+0.));//8，double的等级最高，输出double的字节数，而不是longlong的
//强制类型转换
printf("%d\n", sizeof(9u + (int)8ull + 0176 - (char)1578.f));//4，int的等级最高
```

### 字符型

字符型存储不是字符的影像，而是字符影像的字符编码

单字节编码通常指ASCII码，双字节编码一般指unicode码

char与wchar区别是单字节（ASCII）和双字节（unicode，支持汉字）

```c
wchar_t hanzi = L'姬';//L是双字节字符的前缀，=0x59ec
```

```c
#include<stdio.h>
int main()
{
	printf("影像方式显示：%c\n", 0b01010110);//ASCII码 十进制对应86
	char ch1 = 'A';
	char ch2 = 65;
	char ch3 = '\101';//0113 八进制设置
	char ch4 = '\x41';//0x55 十六进制设置
	printf("%c %c %c %c", ch1, ch2, ch3, ch4);
	return 0;

}
```

```c
printf("1234\b\b567\b890\n");//1256890
```

\b：退格，并不是删除而是退回之后再有输入的覆盖之前的

```c
printf("12345678\r90\n");//90345678
```

\r：回到行首，之后类似于退格覆盖之前输入的东西，但是换行的\n是在最后换行的

```c
printf("子曰：\"学而时习之，不亦说乎。\"\n");//子曰："学而时习之，不亦说乎。"
printf("100%%\n");//100%
```

被源代码、printf所征用的字符，用特殊的方式才能输出

## scanf 格式化输入

```c
#define _CRT_SECURE_NO_WARNINGS //关闭安全警告，放在第一句
#include<stdio.h>
int main()
{
	int a = 1, b = 2, c = 3;
	scanf("%d%d%d", &a, &b, &c);
	printf("%d %d %d\n", a, b, c);

	return 0;
}
```

注意：连续输入中间不空格，不写换行符，写取地址符

从 Visual Studio 2005 开始，Microsoft 在 C 运行时库中引入了"安全开发生命周期"，将 `scanf` 等函数标记为"可能不安全"，并给出警告 C4996：提供了替代方案scanf_s

```c
char x, y;
scanf_s("%c%c", &x, 1, &y, 1);//通过显式指定缓冲区大小，防止输入超过缓冲区容量
```

### 浮点数的 scanf

```c
double m = 0;
float n = 0;
scanf("%lf", &m);
scanf("%f", &n);
printf("m=%.2f  n=%.2f\n", m, n);
```

对于double类型的浮点数输入，需要在f前写一个小写L

### 工作原理

按照格式扫描，空格和换行都是默认合法的间隔，遇到第一个非法格式字符就停止读取

如果将scanf改成

```c
scanf("%d,%d,%d", &a, &b, &c);
```

在上面这个例子中强制使用逗号为合法间隔，此时空格和换行就是非法间隔不适用了

如果改成

```c
scanf("a=%d,b=%d,c=%d", &a, &b, &c);
```

这样就必须严格按照a=%d,b=%d,c=%d的格式输入，其他格式的输入不会被识别

### scanf 的返回值

```c
int r;
r = scanf("a=%d,b=%d,c=%d", &a, &b, &c);
printf("成功读取%d个变量\n",r);
```

按上述所示，如果a部分按照格式输入数字，之后不按照格式输入，r的值就等于1

## 源代码执行原理

源代码到exe经过的几个时期

预处理期， 在这一阶段，源码中的所有预处理语句得到处理，#include语句所包含的文件内容替换掉语句本身，所有已定义的宏被展开

编译期，编译器对源码进行词法分析、语法分析、优化等操作，最后生成汇编代码

汇编期：生成机器语言代码，保存在后缀为.o的目标文件中

连接期，把用到的库函数和你自己编写的这些机器指令或者目标文件汇总形成一个整体，这个整体就叫可执行文件

执行期，执行exe可执行文件

## 流程结构

### if（二选一）

```c
#define _CRT_SECURE_NO_WARNINGS
#include<stdio.h>
int main()
{
	int score = 230;
	if (score >= 280)
	{
		printf("能上理工类本科二批\n");
	}
	else
	{
		printf("不能上\n");//输出这个
	}

	if (score)
	{
		printf("能上理工类本科二批\n");//输出这个
	}
	else
	{
		printf("不能上\n");
	}

	return 0;
}
```

注意：在C语言中不存在布尔类型，所以C语言采用整型即0与非0代表true和false，示例中第二个if就是判断了非0数据，即true，输出了第一段文字

### switch（多选一）

```c
#define _CRT_SECURE_NO_WARNINGS
#include<stdio.h>
int main()
{
	char grade;
	printf("输入成绩等级\n");
	scanf("%c", &grade);
	switch (grade)
	{
	case'A':
	case'a':
		printf("卓越\n");
		break;
	case'B':
	case'b':
		printf("优秀\n");
		break;
	case'C':
	case'c':
		printf("良好\n");
		break;
	case'D':
	case'd':
		printf("及格\n");
		break;
	default:
		printf("惨不忍睹\n");
		break;
	}
	return 0;
}
```

注意：别忘了break

### for（知起止循环）

```c
#define _CRT_SECURE_NO_WARNINGS
#include<stdio.h>
int main()
{
	int days;
	for (days = 1; days <= 14 + 7; days++) {
		//初始化；循环条件；增量变化
		printf("隔离第%d天\n",days);
		//循环体
	}
	return 0;
}
```

### while（每当型循环）

```c
#define _CRT_SECURE_NO_WARNINGS
#include <stdio.h>
int main()
{
	int money = 1000;
	int low = 50;
	while (money > low)
	{
		money -= low;
		printf("还剩%d元钱\n", money);
	}
	return 0;
}
```

### do...while（先执行后判断）

```c
#define _CRT_SECURE_NO_WARNINGS
#include <stdio.h>
int main()
{
	int workDay = 25;
	do
	{
		workDay -= 1;
		printf("距离发工资还有%d天\n",workDay);
	} while (workDay >= 1);

	return 0;
}
```

这是先执行的语句，所以即使不满足条件也会先执行一次，之后再判断

### 死循环

现实开发会通过死循环来判断玩家做出什么操作，网络程序中也会不间断查找谁在连接

```c
int a = 10;
while(a < 20);//空语句占位了循环体
{
	a += 5;
	printf("%d", a);
}
```

```c
int a = 10;
for (;;) {
	a++;
	printf("%d\n", a);
}
```

```c
xuanshi:
	printf("为人民服务\n");
	goto xuanshi;
```

```c
while (1)
{
	printf("为人民服务\n");
}
```

## 调用命令提示符命令

```c
#define _CRT_SECURE_NO_WARNINGS
#include<stdio.h>
#include<Windows.h>
int main()
{
	int floor = 25;
	while (floor-1) {
		floor--;
		system("cls");
		printf("%d\n", floor);
		Sleep(500);
	}

	return 0;
}
```

system后面括号里的内容，表示让命令提示符执行里面的操作，cls代表清空命令提示符的表面内容

sleep表示休眠多少毫秒

## 运算符

算术运算符：+ - * /  % （ ）

赋值运算符：= += -= *= /= %= ++ --

关系运算符：> >= < <= == !=

逻辑运算符：! && || （会涉及短路问题）

三目运算符：? :

位运算符：& | ~ ^ << >>（优先级：与>异或>或）

无论是按位与、按位或、按位取反、按位异或、左移、右移，都是对十进制数的补码的每位进行操作

```c
char a = 10;
char b = -5;
a <<= 1;
b <<= 1;
printf("%hhd %hhd\n", a, b);//20 -10
char c = 10;
char d = -5;
c >>= 1;
d >>= 1;
printf("%hhd %hhd", c, d);//5 -3
```

左移补0，右移补符号位

其他运算符：sizeof ,（逗号运算符） &（取地址） *

```c
int a = (1,2,3,4,6);
int b = 1,2,3,4,6;
```

a的值是6，b的值是1，有括号称作逗号表达式，没有括号称作逗号语句

逗号表达式的作用是用最右侧的表达式的值代表逗号表达式的值

## 指针

### 地址相关运算

```c
#include <stdio.h>
int main()
{
	int a = 5;
	printf("%d\n", &a);
	printf("%p\n", &a);
	printf("直接访问：%d\n", a);
	printf("间接访问：%d\n", *&a);
	return 0;
}
```

%p是指针方式打印，也就是十六进制数

&是取地址运算符，*是取值运算符

### 指针变量

```c
int a = 5;
int* p;
p = &a;
printf("直接访问：%d 间接访问：%d\n", a, *p);
```

构造指针变量，本例中*p可以完全代替a，比如参与任何的算术运算

注意：*p++表达的意思是p自增1之后再取值，也就是说并不是在原本的那个地址上操作

需要如此操作，需要写成(*p)++

### 指针变量字节数

```c
char* pc = &a;
long long* pll = &a;
short* ps = &a;
printf("指针大小：%d %d %d %d\n", sizeof(p), sizeof(pc), sizeof(pll), sizeof(ps));//4 4 4 4
printf("间接访问的空间大小：%d %d %d %d\n", sizeof(*p), sizeof(*pc), sizeof(*pll), sizeof(*ps));//4 1 8 2
```

地址都是统一格式，所以都是4字节；

### 指针的移动

根据数据类型不同，移动的步伐大小也不同

```c
printf("%d %d %d\n", p, p + 1, p + 2);//+4
printf("%d %d %d\n", pc, pc + 1, pc + 2);//+1
printf("%d %d %d\n", pll, pll + 1, pll + 2);//+8
printf("%d %d %d\n", ps, ps + 1, ps + 2);//+2
```

### void 指针

```c
void* pv = &a;
```

仅用于保留地址，需要时通过强转方式变为任意类型指针

### 大端与小端

```c
0x123456在内存中的存储方式

- 大端模式//打印、计算、网络传输

  低地址 -----> 高地址
  0x12 | 0x34 | 0x56
- 小端模式//内存

  低地址 -----> 高地址
  0x56 | 0x34 | 0x12
```

大小端模式各有优势

小端模式强制转换类型时不需要调整字节内容，直接截取低字节即可

大端模式由于符号位为第一个字节，很方便判断正负

注意:

指针不要位移到不属于本程序的内存空间，也不要利用指针改变不属于本程序的内存空间的数据

声明多个指针变量类型时，*不能省略。

指针变量的初始值如果没有明确指向目标用NULL赋值

### 多级指针

指向指针的指针

```c
int a = 6;
int* p = &a;
int** pp = &p;
int*** ppp = &pp;
```

## 数组

一组同类型变量的集合

名词：成员/元素 下标/index/索引 长度

```c
int age = 10;
int ages[5];
printf("字节数：%d %d\n", sizeof(int), sizeof(age));//4 4
printf("字节数：%d %d\n", sizeof(int[5]), sizeof(ages));//20 20
```

VS中数组长度不支持设置为变量，可以通过定义足够长，用变量控制有效长度

```c
//1  完全初始化
int a[4] = { 1,8,6,9 };
//2 不完全初始化、其它成员默认 0
int b[4] = { 1,8 };
int c[4] = { 0 };//清零初始化
//3 初始化成员个数 自动决定长度
int arr[] = { 1,8,4,2,5,3,4,7 };
```

计算数组长度

```c
int ds[]={10,30,43,43,43,23,12,40};
int length=sizeof(ds)/sizeof(ds[0]);
```

读取地址

```c
printf("%d %d %d\n", as, as + 1, as + 2);
printf("%d %d %d\n", &as[0], &as[1], &as[2]);
```

获取内容

```c
printf("%d %d %d\n", *as, *(as + 1), *(as + 2));
printf("%d %d %d\n", as[0], as[1], as[2]);
```

### 折半查找

```c
#include <stdio.h>
int main()
{
	//在一组有序的数列中，寻找一个指定的数字所在的下标
	int d[] = {1,5,8,12,23,44,56,78,99,200};
	int find=12;
	int left = 0;
	int right = sizeof(d) / sizeof(d[0]);
	int mid;
	do
	{
		mid = (left + right) / 2;
		if (d[mid] == find) {
			printf("找到了:%d\n",mid);
			break;
		}
		else if (d[mid] < find)left = mid + 1;
		else right = mid - 1;
	} while (left <= right);
	if (!(left <= right))printf("没找到\n");

	return 0;

}
```

### 约瑟夫问题

著名犹太历史学家Josephus有过以下的故事：在罗马人占领乔塔帕特后，39 个犹太人与Josephus及他的朋友躲到一个洞中，39个犹太人决定宁愿死也不要被敌人抓到，于是决定了一个自杀方式，41个人排成一个圆圈，由第1个人开始报数，每报数到第3人该人就必须自杀，然后再由下一个重新报数，直到所有人都自杀身亡为止。然而Josephus 和他的朋友并不想遵从。首先从一个人开始，越过k-2个人（因为第一个人已经被越过），并杀掉第k个人。接着，再越过k-1个人，并杀掉第k个人。这个过程沿着圆圈一直进行，直到最终只剩下一个人留下，这个人就可以继续活着。问题是，给定了和，一开始要站在什么地方才能避免被处决。Josephus要他的朋友先假装遵从，他将朋友与自己安排在第16个与第31个位置，于是逃过了这场死亡游戏。

关键：找出死亡位置

```c
i = (i + m - 1) % n;
```

完整代码

```c
#include <stdio.h>
int main()
{
	int r[41] ;
	int m=3;//数到几
	int n=41;//当前活着的人数
	int i=0,j=0,k;
	for( k=0;k<41 ;k++ )
	{
		r[k]=k+1;
	}
	for (;n>0; n--) {
		i = (i + m - 1) % n;
		printf("%d \n", r[i]);
		for (j = i; j < n-1; j++) {
			r[j] = r[j + 1];
		}
	}
	return 0;
}
```

### 深度理解[ ]

```c
printf("%d %d\n", as[1], 2[as]);
printf("%d %d\n", (as + 2)[1], (as + 3)[-1]);
```

参考地址[偏移] 等同于 *（参考地址+偏移）

所以，2[as]和as[2]是等价的，(as + 2)[1]是as+3偏移也就是下标2的内容

辨析：指针+1与数组名+1

```c
int as[]={10,20,30,40,50};
int *p;
printf("%d %d\n", as + 1, p + 1);//结果相同
p++;
//as++;
```

p作为指针变量可以进行+1操作，可以指向任意内存位置

而as作为数组名，是找到数组内存的唯一依据，是地址常量，不可修改

注意：数组名和指针的拆与合

```c
for (int i = 0; i < 5; i++) printf("%d %d %d %d\n", as[i], *(as + i), *(p + i), p[i]);
```

```c
as[i] 到 *(as + i)是拆的过程，就是将[]去掉，将运算符和取地址符补齐
```

```c
而*(p + i) 到 p[i]是合的过程，也就是拆的逆过程
```

利用指针变量实现数组的遍历操作

```c
for (int i = 0; i < 5; i++) printf("%d ", *p++);
```

### 指针数组

指针类型的数组简称， 每个数组成员都是指针变量

```c
int b = 2;
int *p[4]={NULL };
int arr[4] = { 5,6,7,8 };
int* pa[4] = { &b,arr,arr + 1,&arr[3] };
for (int i = 0; i < 4; i++)printf("%d\n", *pa[i]);//利用指针数组遍历指向的值
```

### 数组指针

可以指向一组数的指针

```c
int a[] = {1,2,3,4};
int(*parr)[4]=&a;
printf("%d\n", sizeof(*parr));//16
```

本例中，如果在监视里查看类型

| 名称   | 类型    | 备注                     |
| ------ | ------- | ------------------------ |
| a      | int[4]  | 数组类型                 |
| a+0    | int *   | 第0个成员的地址          |
| *(a+0) | int     | 第0个成员的空间          |
| *a     | int     | 第0个成员的空间          |
| &a     | int[4]* | 数组类型的地址           |
| &a+1   | int[4]* | 数组整体偏移，会增加16位 |

```c
int(*parr)[4]=&a;
```

所以，在上例中写的是=&a，而不是=a，因为&a和左侧内容类型相同，都是数组类型的地址，而a是数组类型

用数组指针访问其中的整数

```c
printf("%d\n", (*parr)[0]);
printf("%d\n", (*parr)[1]);
printf("%d\n", (*parr)[2]);
printf("%d\n", (*parr)[3]);
```

而在笔试题中可能出现

```c
将(*parr)[0]利用数组名和指针的拆与合，拆解，*((*parr)+0)，进而优化为**parr
```

### 二维数组

```c
数组名[先行][后列]
```

```c
int ge[3][4] = { 0 };
int hs = sizeof(ge) / sizeof(ge[0]);
int ks = sizeof(ge[0]) / sizeof(int);
```

数组名用法

```c
int arr[3][4]={1,2};
//A：找到 某行的首地址
printf("%d %d %d\n", arr, arr + 1, arr + 2);
//B：得到 某行的存储空间
printf("%d %d %d\n", **arr, **(arr + 1), **(arr + 2));
//C：找到某行内-某列的地址
printf("%d %d %d\n", *(arr + 1), *(arr + 1)+1, *(arr + 1)+2);
printf("%d %d %d\n", arr[1],arr[1]+1,arr[1]+2);
//D：得到某行 某列的存储空间
printf("%d %d %d\n", *(*(arr+1)),*(*(arr+1)+1), *(*(arr + 1) + 2));
```

利用指向一维数组的指针 遍历每一行 每一个元素成员

```c
int(*ph)[4] = arr;
for (int h = 0; h < 3; h++) {
	printf("%d %d %d %d\n", **ph, (*ph)[1], *(*ph + 2), (*ph)[3]);
	ph++;
}
```

行指针

```c
int(*ph)[4] = arr;
for (int h = 0; h < 3; h++) {
	printf("%d %d %d %d\n", **ph, (*ph)[1], *(*ph + 2), (*ph)[3]);
	ph++;
}
```

## EasyX

```c
#include<graphics.h>
#include<stdlib.h>
int main()
{
	//1 创建画板
	initgraph(800, 600,EX_NOCLOSE);//宽800高600的画板
	//2 绘画
	//外观设置
	setlinecolor(GREEN);
	setlinestyle(PS_DASH, 2);//虚线
	// 再绘图
	circle(400, 300, 100);
	//3 关闭画板

	//阻止结束
	system("pause");


	return 0;
}
```

EX_NOCLOSE代表easyx生成的界面不能被关闭，只能通过关闭命令提示符来关闭

## 函数

函数是对一段流程代码的封装

函数能够增强代码的：可维护性、可阅读性、可复用性。

函数的三种状态：前置声明状态、定义实现状态、调用执行状态。

函数调用才执行，执行完消失依靠于栈，所以在一条语句内分别调用两次函数的话，会先执行后面调用函数的语句

```c
int add_all(int a[] )
{
	int sum=0;
	int len=sizeof(a)/sizeof(a[0]);
	int i;
	for(i=0;i<len;i++)
	{
		sum+=a[i];
	}
	return sum;
}
```

本意是想执行数组值累加，但是数组作形参，被识别成了指针变量，所以结果为数组第一个值

第一种解决方法，把数组长度直接告知

```c
int add_all(int a[] , int len)
```

第二种解决方法，传入指针数组逐个读取数组数字，但是只能定长读取

```c
int add_all_2(int (*a)[5])
{
	int sum = 0;
	int i;
	for (i = 0; i < 5; i++)
	{
		sum += (*a)[i];
	}
	return sum;
}
```

函数的传递方式可以称作复制方式，传值时变量名作实参，而传址时变量的地址作实参，相当于把空间传递，指针的间接访问

```c
void swap(int*p,int *q)
{
	int t;
	t = *p; *p = *q; *q = t;

}
```

### 函数执行原理

kernel操作系统内核支持运行环境MSVCRT，运行环境启动exe可执行文件，之后把代码中所有函数加载到内存中的代码区，全局变量放到全局/静态区，之后主函数main进入调用栈，main里的局部变量才会放入栈区

函数名字的本质： 代表函数在内存中的地址，作用是找到代码区的代码，()传入实参，才能执行代码区的指令

### 函数指针

```c
int (*pfun)(int, int);
```

显式指向函数（传统指针）

```c
int (*pfun)(int, int);
pfun = &add_int;
printf("%d\n", (*pfun)(3, 7));
```

隐式指向函数

```c
int (*padd)(int a, int b) = add_int;
printf("%d\n", padd(9,6));
```

批量执行函数

```c
double(*pm)(double) = sqrt;
printf("%g", pm(-3.42));
pm = fabs;
printf("%g", pm(-3.42));
pm = ceil;
printf("%g", pm(-3.42));
pm = floor;
printf("%g", pm(-3.42));
//用数组批量执行函数
double can[4] = { -3.42 ,-3.42 ,-3.42 ,-3.42 };
double (*pms[4])(double) = { sqrt,fabs,ceil,floor };
for (int i = 0; i < 4; i++) printf("%g\n", pms[i](can[i]));
```

### 函数递归

阶乘

```c
#include <stdio.h>
int fun01(int n);
int main ()
{
	printf("%d\n",fun01(5));
	return 0;
}
int fun01(int n)
{
	if (n==1) return 1;
	return n*fun01(n-1);
}
```

辗转法求最大公约数

```c
#include <stdio.h>
int fun11(int m,int n);
int main ()
{
	printf("%d\n",fun11(124,36 ));
	return 0;
}
int fun11(int m,int n)
{
	if (m % n == 0)return n;
	return fun11(n, m % n);
}
```

汉诺塔

```c
#include <stdio.h>
void fun14(int n, char from,char mid,char to);
int main ()
{
	 fun14(10, 'a','b','c');
	return 0;
}

void fun14(int n, char from,char mid,char to)
{
	//终止条件
	if (n == 1) {
		printf("%c --> %c\n", from, to);
		return;
	 }
	//递推逻辑
	fun14(n - 1, from, to, mid);
	printf("%c --> %c\n", from, to);
	fun14(n - 1,mid, from, to);
}
```

## extern

单词本意外部的，表示此变量的定义来自别的源代码文件此处只是使用它

声明此变量在其他外部文件

```c
extern int n;
```

不可以赋值，而变量本身是在其他文件中正常声明即可并分配内存

```c
#include "tcsgame.h"
#include<stdlib.h>
void gameover(void)
{
	extern int stop;//借用 外部链接声明
	stop = 1;
	exit(0);//强行关闭程序
}
```

在本例中，stop变量在SnakeGame.cpp中已经被定义，一般作为重构函数者，不建议改动原文件变量位置，所以采用extern

### 全局变量与局部变量

```c
#include <stdio.h>

int i ;
void fun();
int main31 ()
{
	/*局部变量与全局变量的声明*/

	/*变量的作用域与生命周期*/
	printf("%d\n",i);
	fun();
	printf("%d\n",i);
	fun();
	return 0;
}

void fun()
{
	int i=10;
	i++;
	printf("%d\n",i);
}
```

i++是对局部变量i进行自增操作（栈区）

局部变量的生命周期是在调用函数时被创造，调用完函数被销毁，而全局变量是程序项目启动被创造，程序项目彻底结束被回收

## typedef

type(类型)def(define，定义)

增强代码可读性

```c
typedef unsigned int size_t;
```

对描述类型过程的封装

```c
typedef char KB[1024];
KB m, n;
typedef int Map[20][30];
Map maps[3];//三维数组
Map* pm;//指向地图的指针，二维数组指针
```

指针类型

```c
//int* a, b, c;
typedef int* P_Int;
P_Int a, b, c;
```

第一行的例子中只有a是指针，要想全设置为指针需要全部加*，自定义P_Int可以实现不用重复书写

函数类型

```c
typedef double (*P_Math)(double);
P_Math pm[4];
```

嵌套定义

可以再使用typedef定义typedef定义的类型

## 枚举

枚举是数据类型中的扩展类型，是对数据可读性的扩展

枚举值本质就是整数，可方便阅读的整数

```c
enum fang_wei{N,S,W,E};//enum 类型名{该类型可能值}
enum fang_wei fw = E;
```

用typedef简化代码

```c
typedef enum fang_wei FangWei;
FangWei f = N;
```

代码背后设置enum的数值不一定从0开始，可以乱序

```c
typedef enum week{Mon=1,THU,WED,SUN=0}WEEK;
WEEK w = WED;
```

## const

修饰一个变量使之变成常量，即使一开始不赋值，之后也不可以再赋值

```c
const int a = 8848;
//a = 8898;
//a += 2;
//a *= 3;
//a++;
```

在VS中，通过间接访问可以修改常量值，但是这种行为不建议且因编译器不同可能会报错

```c
const int a = 8848;
int* pa = &a;
*pa = 9000;
```

如果将设置常量的语句写在全局范围内，则会在程序启动时被创建于常数区，由于常数区的值只能读取不能修改，所以这次通过间接访问修改则会报错

指向可改 内容不可改

```c
int m = 3, n = 6;//合法申请的内存空间
const int* p = &m;//指针变量 指向空间
//*p = 8;//间接访问空间，常量指针
p = &n; //改变指向
```

指向不可改 内容可改

```c
int m = 3, n = 6;//合法申请的内存空间
int* const p = &m;//指针变量 指向空间
*p = 8;//间接访问空间
//p = &n; //改变指向，指针常量
```

指向不可改 内容不可改

```c
int m = 3, n = 6;//合法申请的内存空间
const int* const p = &m;//指针变量 指向空间
//*p = 8;//间接访问空间
//p = &n; //改变指向
```

## 宏替换

```c
#include <stdio.h>
#define LEN 150//没有分号
int main()
{
	int a[LEN], b[LEN], c[LEN];
	return 0;
}
```

就是在预处理期执行查找替换

```c
typedef int* PINT;
#define Pint int*//定义宏
PINT x, y;
Pint w, v;//使用宏
```

上例中，xyw是int*，v是int

```c
#define PT printf("hello world");
#define A PT PT PT PT PT PT PT PT PT PT
#define B A A A A A A A A A A
B
```

上例不用循环实现输出1000个hello world

用宏和typedef创建一个“布尔型数据”

```c
typedef int boolean
#define true 1
#define false 0
boolean sex = true;
```

有参数的宏

```c
#define ARRAY_LEN_1(array_name) sizeof(array_name)/sizeof(array_name[0])
int arr[] = { 7,9,6,9,85,3,3,8,5 };
int len1 = ARRAY_LEN_1(arr);
#define ARRAY_LEN_2(array_name,array_type) sizeof(array_name)/sizeof(array_type)
double ds[] = { 3.14,2.71828,0.618 };
int len2 = ARRAY_LEN_2(ds, double);
```

一定注意宏里的参数括号与名字之间没有空格

## static

无论创建在全局还是局部，都是和全局变量的生命周期一样程序一开始就创建在全局/静态区

```c
#include <stdio.h>
void fun41()
{
	static int c;
	int i;
	i=10;
	i++;
	c++;

	printf("c=%d,i=%d\n",c,i);
}
int main ()
{
	fun41();
	fun41();
	return 0;
}
```

结果c=1，i=11 c=2，i=11

### 与全局变量的区别

static的量只能在程序中访问，而全局变量可以通过extern在其他外部程序内访问

可以通过在static定义量所在程序编写get函数，之后在其他程序调用函数即可获得数据

## 栈与堆

```c
#include <stdio.h>
#include <malloc.h>
int fun52()
{
	int* pa = malloc(sizeof(int));
	if (pa != NULL)*pa = 10;
	return pa;
}
int main()
{
	int* p = fun52();
	printf("%d\n", *p);
	printf("%d\n", *p);
	printf("%d\n", *p);
	free(p);
	p = NULL;
	return 0;
}
```

malloc的作用是开辟指定的内存空间，实际上是在堆区开辟指定内存空间，而指针pa是在堆区指向内存空间的

所以这个空间不用了需要及时归还，因为不归还会浪费空间，所以要使用free释放内存，实现完整过程

```c
int len = 4;
//int arr[len]
int* pa = malloc(sizeof(int) * len);
pa[0] = 1;
pa[1] = 12;
pa[2] = 14;
pa[3] = 17;
free(pa);
pa = NULL;
```

用malloc在堆中申请内存实现数组内设置变量长度

```c
int* pa = calloc(len, sizeof(int));
```

calloc和malloc区别是calloc是清零的初始化，在VC中malloc的清零会写成好多个cd，代表cleaned data

```c
pa = realloc(pa, sizeof(int) * len);
```

用于重新分配内存，最后一个参数是新内存的字节数，是在原位置进行扩建，不是异位置

### 栈区与堆区的区别

代数区、常数区、全局/变量区都是程序启动准备状态

堆区、栈区是程序运行时动态调整的，两者对向增长；栈区从高到低，堆区从低到高（增长就是指内存分配，从高到低是指越往后分配内存地址数越低）

|                   | 栈区Stack                    | 堆区Heap                   |
| ----------------- | ---------------------------- | -------------------------- |
| 分配方式          | 一次性分配好空间             | 执行分配函数才分配空间     |
| 分配效率          | 较高                         | 较低（会遍历链表）         |
| 存储内容/空间大小 | 少量临时的分配，一般存放指针 | 适用更大的数据             |
| 管理方式          | 由操作系统统一维护           | 更多的是人为管理           |
| 碎片              | 不会产生碎片                 | 会产生碎片（所以需要回收） |

## 字符串

```c
char arr[5] = { 'A',65,'\101','\x41','\n' };
printf("%s", arr);
```

用字符数组创建的数组可以用%s直接遍历打印，但是结束标记不会在数组末尾，导致会多打印许多奇怪的字符

而直接适用string字符串就不会有这种情况，所以字符串和字符数组有一定区别

```c
char str1[] ="Hello";
char *p1 = "Hello";
char *p2="Hello";
str1[0]='h';
p1[0]='h';//错误
p2[0]='h';//错误
p1 = "world";
//str1 = "world";//错误的
```

数组在栈区有独立的存储空间，后面修改时直接修改内容

而字符串常量被创建在常量区（只读），通过指针指向常量，指针不能修改常量，所以后面修改时是错误的

所以，可以在字符数组前写上const，让后面改变时编译器直接报错

```c
printf("%c\n","how are you"[4]);
printf("%s\n","how are you"+4);
```

输出的是

```c
a
are you
```

所以，可以将字符串当成地址看，这样会很好地理解

### strlen

```c
#include <string.h>
char str1[] ="Hello";
printf("%d\n", sizeof(str1));//6
printf("%d\n", strlen(str1));//5
```

strlen不计\0的结束标记空间

sizeof计\0的结束标记空间

### strcpy

```c
#include <string.h>
char a[20];
strcpy(a, "hello");
printf("%s\n", a);
printf("%s\n", strcpy(a, "hi"));
```

strcpy_s

```c
char a[20];
printf("%d\n", strcpy_s(a, 10, "how are you"));
printf("%d\n", strcpy_s(a, 30, "how are you"));
```

会对添加的新字符串长度和被更新的字符数组进行检验，上下两条指令均会崩溃

```c
char * p="12345";
printf("%s\n", strncpy(a, p, 4));
strncpy_s(a, 20, p, 4);
```

strncpy对指定长度进行替换，并且后面不会加\0，而安全用法是验证被替换字符串长度需大于指定长度

### strcat

```c
#include <string.h>
char a[50]="hello ";
char *p="hi ";
strcat(a, p);
printf("%s\n", a);
printf("%s\n", strcat(a, "world."));
/*strcat_s*/
strcat_s(a, 50, "c++");
printf("%s\n", a);
/*strncat*/
printf("%s\n", strncat(a, "ABCDE", 4));
/*strncat_s*/
strncat_s(a, 50, "abcdefg", 3);
printf("%s\n", a);
```

实现字符串的拼接，其余功能类上

### strcmp

```c
#include <string.h>
printf("%d\n", strcmp("java", "python"));//-1
printf("%d\n", strcmp("r", "python"));//1
printf("%d\n", strcmp("apple", "apple"));//0
```

strcmp是通过比较字符串中首个字符的ASCII码的大小，前面大则输出1，相等输出0，后面大则输出-1

stricmp不是标准库函数，可以实现忽略大小写字母的比较

```c
printf("%d\n", stricmp("APPLE", "apple"));//0
```

### strstr

```c
char* p = "how do you do";
const char* pdo = strstr(p, "do");
printf("%s\n", pdo);//do you do
printf("%d\n", pdo - p);//4
pdo = strstr(p, "did");//找不到返回空指针
```

strstr用于搜索字符串在另一个字符串中首次出现的位置（内存地址）

### 类型转换

```c
char str[10];
/*itoa*/
itoa(1234, str, 10);
printf("%d %o %x %s\n", 185, 185, 185, itoa(185, str, 2));
/*atoi,atof atol*/
int n = atoi("1899");
double pi = atof("3.14159");
long long b = atoll("789789165513");
```

a代表ASCII，最后一个数字代表进制数

利用printf使任意数字转字符串

```c
char str[10];
sprintf(str,"%.3f",3.1415926);//3.142
sprintf(str,"lld",3141592653);
```

### 键盘输入

```c
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
char c;
char a[300];
/* 输入一个字符*/
scanf("%c", &c);
scanf_s("%c", &c, 1);
c = getchar();
c = getchar();
c = _getch();
c = getche();
for (int i = 0; i < 6; i++) {
	c = _getch();
	putchar('#');
}
```

getchar()输入可以修改，需要换行确认，因为换行符也在缓冲区，所以要多准备一个getchar()给换行符

_getch()无需确认，立即被读取，屏幕不显示输入内容

_getche()无需确认，立即被读取，屏幕显示输入内容

用循环可以实现掩盖真实内容的方式进行输入

通过scanf输入一个字符串和一个字符

```c
scanf("%s%c", a, &c);
scanf("%s %c", a, &c);
scanf_s("%s %c", a, 300, &c, 1);//安全格式
```

如果输入过程中需要空格间隔时，一定体现出来，否则会将空格识别成单字符

使用scanf无法读取字符串中的空格，所以采用以下方式

```c
gets_s(a,300);
```

也可以使用文件读取方式

```c
fgets(a,300,stdin);
a[strlen(a)-1] = '\0';
puts(a);
```

但是，这种方式会读取\n，所以要采用第二行的方式将\n改为\0

stdin表示标准输入（键盘）

## 结构体

```c
typedef enum card_type {SFZ=8,XSZ,JSZ} CardType;
struct stu_info
{
	int stuNum;
	CardType cardType;
	char cardNum[20];
	char name[30];
	char sex;
}s1,s2;
struct stu_info s3, s4;
struct stu_info s3 = { 3,SFZ,"110101200001010011","ZhangSan",'M' },
				s4 = { .name = "LiSi",.sex = 'F' };
scanf_s("%d%d%s%s %c", &s1.stuNum, &s1.cardType, s1.cardNum, 20, s1.name, 30, &s1.stuNum);
```

注意枚举的定义形式、结构体的定义形式、结构体的两种使用方式和全赋值部分赋值的方式

用typedef简化结构体定义形式

```c
typedef struct book
{
	char bookName[20];
	char writer[30];
	int year;
	double price;
}BOOK;
int main ()
{
	BOOK books[2] = {
		{"活着", "余华", 2000, 15.6},
		{"三体", "刘慈欣", 2000, 30.0}
	};
	for (int i = 0; i < 2; i++) {
		printf("%-12s %-8s %6d %7.2f\n",
			books[i].bookName,
			books[i].writer,
			books[i].year,
			books[i].price);
	}

	return 0;
}
```

结构体指针的三种形式

```c
typedef BOOK* Pbook;
int main ()
{
	struct book* p1 = books;
	BOOK* p2 = books + 1;
	Pbook p3 = &books[1];
}
```

struct具有对齐机制

默认向其中的每一个属性分配属性中所需最大单个的内存，能使用的正常分配，有剩余的下一个继续使用，不够的继续往下开辟4字节内存存储，即使后续有更小的内存可以将上述剩余的空间补齐，也不能跳回使用

注意，数组长度不计，仅以数据类型为依据进行区分，而指针变量本质是保留地址号，地址号长短和x86（4字节）和x64（8字节）有关

对齐机制实例

```c
#include <stdio.h>
struct HH//12
{
	int a;
	short c;
	short d;
	char e;
	char b;
	short f;
}  ;
struct FF//12
{
	char a[5];
	char *e;
}  ;
int main  ()
{
	printf("%d\n",sizeof(struct HH));
    printf("%d\n",sizeof(struct FF));
	return 0;
}
```

位域

按照位域机制分配的存储空间会以紧挨着的形式进行按位分配，断开是指重开辟一个数据类型的空间继续存放后续的数据

```c
#include <stdio.h>
typedef struct
{
	 int a:2;//a变量占两个位的存储空间 但int会分配4个字节。
	 int b:8;
	 int c:2;
	 int :0;//断开
	 int d:2;

}  TT;
int main   ()
{
	TT t ;
	printf("%d\n",sizeof(TT));//8
    t.a = 9;
    printf("%hhd",t.a);//1  因为9是0000 1001 取后两位即01，符号位0 数字位1，所以是1
	return 0;
}
```

共用体

共用体的特点是共享空间，而结构体是各自有各自的空间，对齐补齐机制类似于结构体

```c
#include <stdio.h>
union aa
{
	int a ;
	char b;
} ;
int main()
{
	union aa h;
	h.a=65;
	printf("共用体大小%d\n",sizeof(union aa));//4
	printf("%c\n",h.b);//A
	return 0;
}
```

## 链表

声明节点

```c
typedef struct node
{
	int data;//数据域
	struct node * next;//下一个节点
} Node, *P_NODE;
```

创建节点变量、链接节点

```c
Node n1 = { 0,NULL };
Node n2 = { 2,NULL };
Node n3 = { 4,NULL };
Node n4 = { 5,NULL };
//链接所有节点
n1.next = &n2;
n2.next = &n3;
n3.next = &n4;
```

遍历链表

```c
Node* p = &n1;
while (p != NULL) {
	printf("%d\n", p->data);
	p = p->next;
}
```

上面创建的链表是在栈区创建的，但更多时候需要在堆区创建

```c
#include <malloc.h>
P_NODE p1 = malloc(sizeof(Node));
p1->data = 0;
p1->next = NULL;
```

用更快捷的方式链接链表

```c
PNode create(int data)
{
	PNode newnode = malloc(sizeof(Node));
	newnode->data = data;
	newnode->next = NULL;
	return NULL;
}
PNode header = NULL;
PNode ender = NULL;
void add(PNode node)
{
	if (header == NULL)
	{
		header = node;
		ender = node;
	}
	else
	{
		ender->next = node;
		ender = node;
	}
}
```

插入节点（后插入）

```c
void insert_behind(int index, PNode node)
{
	PNode p = header;
	for (int i = 0; i < index; i++)
	{
		p = p->next;
	}
	PNode q = p->next;
	node->next = q;
	p->next = node;
}
```

## 文件

```c
#include<stdio.h>
#include<stdlib.h>
int main()
{
	FILE* readFile = fopen("d:\\bbb.txt","rb");
	if (readFile)//如果文件打开成功
	{
		fclose(readFile);//关闭文件流。
		readFile=NULL;//释放文件指针。
	}
	else
	{
		printf("文件不存在\n");
	}
	return 0;
}
```

rb代表只读（r）二进制文件（b）

```c
FILE* pf = fopen("d:/myfile/黑名单.txt", "wt");
if (pf != NULL)
{
	puts("创建成功");
	fclose(pf);
	pf = NULL;
}
else
{
	puts("创建失败");
}
```

用w只写模式，若改成at就是追加，即在原有文本之后再写后续内容

```c
int r;
r = rename("d:/myfile/黑名单.txt", "d:/myfile/白名单.txt");
printf("%s %d\n", r == 0 ? "成功修改" : "失败", r);
```

给文件改名

```c
r = remove("d:/myfile/白名单.txt");
printf("%s %d\n", r == 0 ? "成功删除" : "删除失败", r);
```

删除文件

文件处理模板

```c
FILE* pf = fopen("", "");
if (pf != NULL)
{


	fclose(pf);
	pf = NULL;
}
```

能向屏幕打印的 就能打印到文件里

```c
printf("beijing time %02d : %02i\n", 9, 57);
puts("hello world");
putchar('*');

fprintf(pf, "beijing time %02d : %02i\n", 9, 57);
fputs("hello world", pf);
fputc('*', pf);
```

读取若干整数

```c
FILE* pf = fopen("d:/myfile/cj.txt", "rt");
if (pf != NULL)
{
	int n;//char str[20];
	while(!feof(pf) && fscanf(pf, "%d"/*%s*/, &n) > 0){//不是文件尾部 并且数据读取成功
		printf("%d\n", n);//puts(str);
	}
	fclose(pf);
	pf = NULL;
}
```

用注释标注的内容体现出读取若干行文字的代码

文件光标

```c
FILE* pf = fopen("d:/myfile/zm.txt", "r+t");//r+ 读写
if (pf != NULL)
{
	printf("光标位置：ld\n", ftell(pf));//0
	char ch = fgetc(pf);
	printf("光标位置：ld\n", ftell(pf));//1
	char str[10];
	fscanf(pf, "%5s", str);
	printf("光标位置：%ld\n", ftell(pf));//6
	fclose(pf);
	pf = NULL;
}
```

回到开头

```c
rewind(pf);
```

任意定位

```c
fpos_t wz = 12;
fsetpos(pf, &wz);//将光标定位到第12个（从0开始）
```

修改光标位置的数据

```c
//三个参数：文件指针，偏移量，参考位置
//修改数据一定要进行修改重定位（fseek）
fseek(pf, 0, SEEK_CUR);//定位在当前光标位置
fputc('r', pf);//将r覆盖在原先的字符上
fseek(pf, 0, SEEK_SET);//定位在开头处位置
fputc('a', pf);
fseek(pf, -5, SEEK_END);//定位在结尾处位置之前的五个位置
fputc("hello", pf);
fclose(pf);
pf = NULL;
```

向二进制文件进行写入操作 整型变量

```c
FILE * writeFile=fopen("d:\\data.txt","wb");
int n = -1;
int m = 0x41424344;
fwrite(&n, sizeof(int), 1, writeFile);
fwrite(&m, sizeof(int), 1, writeFile);//DCBA，小端存储所导致
```

写入数组

```c
int arr[5] = { 97,98,10,48,100 };
fwrite(arr, sizeof(int), 5, writeFile);
fwrite(arr, sizeof(int[5]), 1, writeFile);//等价的写法
```

读操作

```c
FILE * readFile=fopen("d:\\data.txt","rb");
//1 读取一个整型变量
int a;
fread(&a, sizeof(int), 1, readFile);
printf("%d\n", a);
fread(&a, sizeof(int), 1, readFile);
printf("%x\n", a);//十六进制
//2 读取一个数组
int arr[30];
int count = fread(arr, sizeof(int), 30, readFile);//成功读取的数量
for (int i = 0; i < count; i++) printf("%d\n", arr[i]);
```

文件复制

```c
FILE * from = fopen("d:\\白名单.txt","rb");
FILE * to = fopen("d:\\bmd.txt","wb");
unsigned char buffer[1024];
int len;//实际读取的长度
if (from != NULL && to != NULL)
{
	while ((len = fread(buffer, sizeof(char), 1024, from)) > 0)
	{
		fwrite(buffer, sizeof(char), len, to);
	}
	fclose(from);
	fclose(to);
	from = to = NULL;
}
```

文件复制原理：从文件来源（from）经过临时存储（buffer），一般一次运输千字节，运到复制到目标（to）
