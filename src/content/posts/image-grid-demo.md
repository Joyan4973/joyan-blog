---
title: "图片画廊网格：语法与完整示例"
published: 2026-07-13
description: "图片画廊网格的写法、参数、裁切规则、响应式布局、图注与灯箱行为完整说明。"
tags: [Markdown, Gallery, Image Grid, Demo]
category: "Examples"
draft: false
---

`:::grid` 是博客提供的图片画廊容器指令。它把普通 Markdown 图片组成统一比例的响应式网格，并自动接入灯箱浏览。适合文章配图、截图集合、作品展示和相册式内容。

同一画廊内的图片会使用相同的卡片比例：默认采用居中裁切填满卡片，保证每行边缘整齐；点击图片后可在灯箱中查看原始完整图片。每个画廊有独立的灯箱分组，不会混入文章其他图片。

> 本文同时是功能文档与可见测试页。请在桌面、平板和手机宽度下查看各示例，并点击任意图片验证灯箱分组。

## 最小写法

在 `:::grid` 与结尾 `:::` 之间直接写 Markdown 图片即可：

````markdown
:::grid
![图片说明](./image-1.webp)

![图片说明](./image-2.webp)
:::
````

一张图片应单独占一段，图片之间保留空行。画廊只用于图片内容；不要在容器中混入普通段落、列表或代码块。

## 参数一览

所有参数均写在起始指令的花括号中：`:::grid{参数="值"}`。

| 参数 | 可选值 | 默认值 | 作用 |
| --- | --- | --- | --- |
| `columns` | `1` 到 `6` 的整数 | `3` | 桌面端每行列数。非法值会回退为 `3`。 |
| `aspect` | 正数比例，如 `16/9`、`3/4`、`1/1` | `16/10` | 每张图片卡片的宽高比例，而非原图比例。 |
| `fit` | `cover`、`contain` | `cover` | 图片填充方式。`cover` 裁切填满；`contain` 保留完整图片并可能留白。 |

完整示例：

````markdown
:::grid{columns="3" aspect="16/9" fit="cover"}
![第一张图片](./image-1.webp "可选图注")

![第二张图片](./image-2.webp "可选图注")

![第三张图片](./image-3.webp "可选图注")
:::
````

## 图注与替代文本

图片的 alt 文本既是无障碍替代文本，也是默认图注。若图片写了可选 title，则 title 会优先作为图注：

```markdown
![用于无障碍说明的文字](./image.webp "展示在图片下方的图注")
```

同一行中，图注会贴齐所有卡片的底部；即使某个图注换行，也不会让其他图注漂浮在不同高度。比例文字如 `3:4`、`16:9` 可以直接写在正文、标题和 alt 文本中，无需转义。

## 布局与裁切规则

桌面端采用 `columns` 指定的列数；窗口宽度小于 `768px` 时最多两列，小于 `480px` 时自动改为单列。卡片外层固定 `aspect` 比例并负责圆角裁切，图片本身会完全填满卡片，避免主题默认图片边距造成留白。

- 选择 `cover`：推荐的默认方式。图片以中心为基准裁切并填满卡片，适合希望视觉整齐的画廊。
- 选择 `contain`：完整显示原图，不裁切；当原图比例与卡片不一致时会出现背景留白，适合图片内容不能被截断的情况。
- 需要保留完整图片又不想留白：把 `aspect` 设置得接近原图比例，或将这张图片单独放入一个网格。

## 默认配置

不传属性时，默认是 3 列、`16/10` 比例与 `cover` 裁切。这里用三张竖图检查默认裁切和图注。

:::grid
![默认配置：竖图一](https://img.picr2.online/1782799804754_image.webp)

![默认配置：竖图二](https://img.picr2.online/1782801278315_36742e4d2078d9a8d3dd32834bea9fab.webp)

![默认配置：竖图三](https://img.picr2.online/1782801227262_90a5bb98f6dd7b807149c6421728746e_720.webp)
:::

## 三列竖图：3:4

指定 `aspect="3/4"` 后，三张竖图会以一致的竖向卡片比例填满。若原图比例不同，`cover` 会从中心裁切边缘。

:::grid{columns="3" aspect="3/4"}
![3:4 测试图一](https://img.picr2.online/1782799804754_image.webp "竖图 1")

![3:4 测试图二](https://img.picr2.online/1782801278315_36742e4d2078d9a8d3dd32834bea9fab.webp "竖图 2")

![3:4 测试图三](https://img.picr2.online/1782801227262_90a5bb98f6dd7b807149c6421728746e_720.webp "竖图 3")
:::

## 三列横图：16:9

此组展示常用的视频封面比例与三列布局。横图比例与卡片接近时，裁切量最小。

:::grid{columns="3" aspect="16/9"}
![16:9 测试图一](https://img.picr2.online/1783936315662_5e79ca613f9614110d71ad0706c16fe2_720.webp)

![16:9 测试图二](https://img.picr2.online/1783936315726_b89ffd27b94a137facd5cc6a7657394f_720.webp)

![16:9 测试图三](https://img.picr2.online/1783936317427_6dd147bd61f10922e8684849d6b27785.webp)
:::

## 双列方图：1:1

双列适合需要较大预览卡片的场景；第三张图片会换到下一行。注意最后一行会保持网格轨道宽度，不会拉伸图片以填满整行。

:::grid{columns="2" aspect="1/1"}
![1:1 测试图一](https://img.picr2.online/1782122884683_2B0432808C6EA4559EB675DFB854899C.webp)

![1:1 测试图二](https://dawn114514.site/_astro/avatar.CK7n4VUV_ZeJu5J.webp)

![1:1 测试图三](https://img.picr2.online/1781606933416_D358AAE455539C600845FF4E3B0568E8.webp)
:::

## 四列与 contain

`fit="contain"` 不裁切原图；如果图片比例和卡片比例不同，会显示主题背景色的留白。这是有意行为，不是布局故障。此处也验证了四列网格与多组灯箱互不干扰。

:::grid{columns="4" aspect="16/9" fit="contain"}
![contain：竖图一](https://img.picr2.online/1782799804754_image.webp)

![contain：竖图二](https://img.picr2.online/1782801278315_36742e4d2078d9a8d3dd32834bea9fab.webp)

![contain：竖图三](https://img.picr2.online/1782801227262_90a5bb98f6dd7b807149c6421728746e_720.webp)
:::

## 单列详情图

单列适用于需要保留较大阅读尺寸的图片。桌面、平板与手机下都保持一列；仍可通过灯箱查看原图。

:::grid{columns="1" aspect="16/9"}
![单列测试图](https://img.picr2.online/1783936315662_5e79ca613f9614110d71ad0706c16fe2_720.webp)
:::

## 五列稀疏行

五列验证允许的较高列数。只有三张图片时，最后一行应保持左对齐，不拉伸图片宽度。

:::grid{columns="5" aspect="1/1"}
![五列测试图一](https://img.picr2.online/1782122884683_2B0432808C6EA4559EB675DFB854899C.webp)

![五列测试图二](https://dawn114514.site/_astro/avatar.CK7n4VUV_ZeJu5J.webp)

![五列测试图三](https://img.picr2.online/1781606933416_D358AAE455539C600845FF4E3B0568E8.webp)
:::

## 六列混合图

六列是当前支持的上限。混用横图和竖图可验证 `cover` 裁切、窄卡片图注和桌面高密度布局；对可读性要求高的正文通常更推荐 2 到 4 列。

:::grid{columns="6" aspect="1/1"}
![六列测试图一](https://img.picr2.online/1782799804754_image.webp)

![六列测试图二](https://img.picr2.online/1782801278315_36742e4d2078d9a8d3dd32834bea9fab.webp)

![六列测试图三](https://img.picr2.online/1782801227262_90a5bb98f6dd7b807149c6421728746e_720.webp)

![六列测试图四](https://img.picr2.online/1783936315662_5e79ca613f9614110d71ad0706c16fe2_720.webp)

![六列测试图五](https://img.picr2.online/1783936315726_b89ffd27b94a137facd5cc6a7657394f_720.webp)

![六列测试图六](https://img.picr2.online/1783936317427_6dd147bd61f10922e8684849d6b27785.webp)
:::

## 四列方图：1:1

四张比例一致的方图是四列布局的典型用法。桌面端应一行显示四张；平板端自动收为两列，手机端收为一列。

:::grid{columns="4" aspect="1/1"}
![方图一](https://img.picr2.online/1783940216954_square_1.webp)

![方图二](https://img.picr2.online/1783940217785_square_2.webp)

![方图三](https://img.picr2.online/1783940217838_square_3.webp)

![方图四](https://img.picr2.online/1783940217915_square_4.webp)
:::

## 六列横图：16:9

六列横图适合缩略图预览、作品索引或截图目录。即使原图的实际比例略有不同，`cover` 也会统一填满 `16/9` 卡片。

:::grid{columns="6" aspect="16/9"}
![横图一](https://img.picr2.online/1783940150717_landscape_1.webp)

![横图二](https://img.picr2.online/1783940150640_landscape_2.webp)

![横图三](https://img.picr2.online/1783940150263_landscape_3.webp)

![横图四](https://img.picr2.online/1783940151277_landscape_4.webp)

![横图五](https://img.picr2.online/1783940152145_landscape_5.webp)

![横图六](https://img.picr2.online/1783940151505_landscape_6.webp)
:::

## 三列竖图：3:4

这组六张竖图用于展示较常见的人像、海报或手机截图布局。六张图片会分为两行，每行三张，图注底部保持对齐。

:::grid{columns="3" aspect="3/4"}
![竖图一](https://img.picr2.online/1783940181581_portrait_1.webp)

![竖图二](https://img.picr2.online/1783940181420_portrait_2.webp)

![竖图三](https://img.picr2.online/1783940181485_portrait_3.webp)

![竖图四](https://img.picr2.online/1783940182219_portrait_4.webp)

![竖图五](https://img.picr2.online/1783940182486_portrait_5.webp)

![竖图六](https://img.picr2.online/1783940182710_portrait_6.webp)
:::

## 边缘关键内容：cover 与灯箱

这组三张图在边缘包含关键文字或图案。`cover` 会保持网格整齐，但可能裁去边缘；点击图片可在灯箱中查看未裁切的完整原图。因此，对边缘内容敏感的图片应搭配清楚的图注，或改用下方的 `contain` 写法。

:::grid{columns="3" aspect="16/9" fit="cover"}
![边缘关键内容一](https://img.picr2.online/1783940109612_critical_1.webp "点击灯箱查看完整边缘内容")

![边缘关键内容二](https://img.picr2.online/1783940108613_critical_2.webp "点击灯箱查看完整边缘内容")

![边缘关键内容三](https://img.picr2.online/1783940109393_critical_3.webp "点击灯箱查看完整边缘内容")
:::

## 极端比例图：contain

对于横幅、长截图等极端比例图片，`contain` 会完整显示原图。与 `cover` 相比，它可能留出主题背景色空白，但不会裁切任何内容。

:::grid{columns="3" aspect="16/9" fit="contain"}
![极端比例图一](https://img.picr2.online/1783940405936_extreme_1.webp)

![极端比例图二](https://img.picr2.online/1783940405639_extreme_2.webp)

![极端比例图三](https://img.picr2.online/1783940406933_extreme_3.webp)
:::

## 透明背景图

透明图片会显示卡片的主题背景。这里使用单列与 `contain`，以便完整观察透明区域、原始边缘和灯箱效果。

:::grid{columns="1" aspect="16/9" fit="contain"}
![透明背景测试图](https://img.picr2.online/1783940445041_transparent_1.webp)
:::

## 灯箱浏览

网格中的每张图片可点击打开 Fancybox 灯箱。灯箱内可缩放、旋转、全屏、查看缩略图，并使用方向键切换。切换范围只限当前 `:::grid` 容器：例如点击“16:9 测试图一”，只能浏览该节的另外两张横图。

如果文章里同时有普通 Markdown 图片，它们仍按原有逻辑单独处理；不会并入任意一个网格画廊。

## 检查清单

1. 每个网格内的图片尺寸一致，图注位于图片下方。
2. 鼠标悬停时图片有轻微放大；点击后可缩放、旋转并使用键盘切换。
3. 例如点击“16:9 测试图一”时，灯箱只能浏览该节的另外两张横图。
4. 将窗口缩小到 768px 以下时，网格最多两列；480px 以下时为单列。
5. “四列与 contain”中的竖图应完整显示且出现留白，不发生裁切。
6. 五列和六列在宽屏下保持指定列数，在较窄屏幕下按响应式规则降为两列或单列。
