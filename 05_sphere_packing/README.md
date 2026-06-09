# 项目五：球体堆积技术（Sphere Packing Techniques）

## 1. 项目简介

球体堆积是离散元方法（DEM）模拟的基础工作之一。在开始任何力学试验
模拟之前，首先需要在模拟区域内生成一组球体颗粒，使其具有合理的初始
排列和孔隙率。不同的堆积方法适用于不同的模拟场景。

本项目全面介绍 YADE 中的球体堆积技术，帮助读者掌握：

- SpherePack 类的核心 API
- 谓词（Predicate）系统的使用与布尔运算
- 随机密实堆积（randomDensePack）的原理与参数
- 规则堆积模式（regularHexa、regularOrtho）
- 粒径分布（PSD）的控制与自定义
- 堆积密度的计算与评估
- 堆积的保存与加载
- GTS 表面定义复杂几何形状

### 运行方式

```bash
cd /home/faust/vibe/yade_learn/05_sphere_packing
yadedaily sphere_packing.py
```

---

## 2. 核心概念详解

### 2.1 SpherePack 类

`SpherePack` 是 YADE 中管理球体集合的核心类。它存储了一组球体的
位置和半径信息，但**不会直接创建模拟中的颗粒**（Body）。需要调用
`toSimulation()` 方法才能将球体添加到模拟中。

#### 创建 SpherePack

```python
sp = pack.SpherePack()  # 创建空的 SpherePack
```

#### 核心方法

| 方法 | 说明 |
|------|------|
| `makeCloud()` | 在指定区域内生成随机球体堆积 |
| `makeClumpCloud()` | 生成团块（clump）堆积 |
| `randomDensePack()` | 生成随机密实堆积（使用沉积法） |
| `fromSimulation()` | 从当前模拟中提取 SpherePack |
| `toSimulation()` | 将 SpherePack 添加到模拟中 |
| `psd()` | 设置或获取粒径分布 |
| `save()` | 保存到文件 |
| `load()` | 从文件加载 |
| `relDensity()` | 计算相对密度 |
| `size()` | 返回球体数量 |

#### makeCloud() 详解

`makeCloud()` 是最常用的堆积生成方法：

```python
sp.makeCloud(
    minCorner=(x_min, y_min, z_min),  # 生成区域最小角点
    maxCorner=(x_max, y_max, z_max),  # 生成区域最大角点
    rMean=0.001,                      # 平均半径
    rRelFuzz=0.3,                     # 半径分散度
    num=1000,                         # 目标颗粒数量
    periodic=False,                   # 是否周期性边界
    seed=42                           # 随机种子（可复现）
)
```

半径生成规则：
```
r = rMean × (1 + rRelFuzz × uniform(-1, 1))
```

当 `rRelFuzz = 0` 时，所有颗粒半径相等（单分散）。
当 `rRelFuzz = 0.3` 时，半径在 0.7×rMean 到 1.3×rMean 之间。

#### toSimulation() 详解

将 SpherePack 中的球体添加到当前模拟：

```python
# 方法 1：使用默认材料（O.materials[0]）
ids = sp.toSimulation()

# 方法 2：指定材料
ids = sp.toSimulation(material=myMaterial)

# 方法 3：指定颜色
ids = sp.toSimulation(color=(0.5, 0.5, 0.8))
```

返回值是添加的颗粒 Body ID 列表。

#### fromSimulation() 详解

从当前模拟中提取 SpherePack：

```python
sp = pack.SpherePack()
sp.fromSimulation()  # 提取 O.bodies 中的所有球体
```

这在以下场景中很有用：
- 保存当前状态
- 将沉积后的颗粒移动到新位置
- 在多个模拟间传递颗粒配置

### 2.2 谓词（Predicate）系统

谓词是 YADE 中定义空间区域的数学对象。它们用于：
- 指定 `randomDensePack` 的生成区域
- 作为条件判断颗粒是否在某个区域内
- 定义复杂几何形状

#### 基本谓词

| 谓词 | 说明 | 示例 |
|------|------|------|
| `inAlignedBox()` | 轴对齐长方体 | `pack.inAlignedBox((0,0,0), (1,1,1))` |
| `inSphere()` | 球体 | `pack.inSphere((0.5,0.5,0.5), 0.3)` |
| `inCylinder()` | 圆柱体 | `pack.inCylinder((0,0,0), (0,0,1), 0.3)` |
| `inHyperboloid()` | 双曲面 | `pack.inHyperboloid(...)` |

#### inAlignedBox()

轴对齐长方体谓词：

```python
# 定义从 (x0, y0, z0) 到 (x1, y1, z1) 的长方体区域
predicate = pack.inAlignedBox((0, 0, 0), (0.1, 0.1, 0.2))
```

#### inSphere()

球形区域谓词：

```python
# 中心在 (0.5, 0.5, 0.5)，半径 0.3
predicate = pack.inSphere((0.5, 0.5, 0.5), 0.3)
```

#### inCylinder()

圆柱体区域谓词：

```python
# 从底面中心 (0, 0, 0) 到顶面中心 (0, 0, 1)，半径 0.3
predicate = pack.inCylinder((0, 0, 0), (0, 0, 1), 0.3)
```

#### 布尔运算

谓词支持布尔运算，可以组合出复杂的几何形状：

```python
# 并集（Union）：使用 | 运算符
# 区域 A 或区域 B
pred_union = pack.inSphere((0.3, 0.3, 0.3), 0.2) | \
             pack.inSphere((0.7, 0.7, 0.7), 0.2)

# 交集（Intersection）：使用 & 运算符
# 区域 A 且区域 B
pred_intersect = pack.inAlignedBox((0, 0, 0), (1, 1, 1)) & \
                 pack.inSphere((0.5, 0.5, 0.5), 0.8)

# 差集（Difference）：使用 - 运算符
# 区域 A 但不在区域 B
pred_hollow = pack.inSphere((0.5, 0.5, 0.5), 0.5) - \
              pack.inSphere((0.5, 0.5, 0.5), 0.3)
```

布尔运算的实际应用：

```python
# 圆柱体减去中心球体（空心圆柱）
hollow_cylinder = pack.inCylinder((0,0,0), (0,0,1), 0.5) - \
                  pack.inCylinder((0,0,0), (0,0,1), 0.2)

# 长方体减去圆柱体（带圆孔的长方体）
box_with_hole = pack.inAlignedBox((0,0,0), (1,1,1)) - \
                pack.inCylinder((0.5,0.5,-0.1), (0.5,0.5,1.1), 0.3)
```

### 2.3 randomDensePack：随机密实堆积

`randomDensePack()` 是生成高质量初始堆积的核心方法。它使用**沉积法**
（dropping algorithm）生成密实堆积：

#### 算法原理

1. 在目标区域上方逐个投放颗粒
2. 颗粒在重力作用下自由下落
3. 颗粒沉积后形成自然堆积
4. 当达到目标孔隙率或颗粒数量时停止
5. 去除目标区域外的颗粒

#### 关键参数

```python
sp = pack.randomDensePack(
    predicate,              # 空间谓词（定义堆积区域）
    rMean=0.001,           # 平均半径
    rRelFuzz=0.3,          # 半径分散度
    spheresInVolume=1000,  # 目标区域内的颗粒数
    memoizeDb='/tmp/packing.db',  # 数据库文件（缓存）
    seed=42                # 随机种子
)
```

#### memoizeDb：缓存数据库

`randomDensePack` 的计算可能很耗时。通过指定 `memoizeDb` 参数，
可以将生成的堆积缓存到数据库文件中。下次使用相同参数时，直接从
数据库加载，跳过生成过程。

```python
# 第一次运行：生成并缓存
sp = pack.randomDensePack(
    pack.inAlignedBox((0,0,0), (0.1,0.1,0.1)),
    rMean=0.001,
    memoizeDb='/tmp/packing_cache.db'
)

# 后续运行：直接从缓存加载
sp = pack.randomDensePack(
    pack.inAlignedBox((0,0,0), (0.1,0.1,0.1)),
    rMean=0.001,
    memoizeDb='/tmp/packing_cache.db'
)
```

### 2.4 regularHexa 与 regularOrtho

#### regularHexa()：六方最密堆积

六方最密堆积（HCP）是理论最密堆积方式之一，堆积密度约为 74%。

```python
sp = pack.SpherePack()
sp.regularHexa(
    pack.inAlignedBox((0, 0, 0), (0.1, 0.1, 0.1)),
    radius=0.005,
    gap=0.0001  # 颗粒间的间隙
)
```

六方堆积的排列模式：
- 每层颗粒呈三角形排列
- 相邻层的颗粒嵌入下层的凹坑中
- ABABAB... 的堆叠顺序

#### regularOrtho()：正交堆积

正交堆积（简单立方堆积）是最简单的规则堆积方式，堆积密度约为 52%。

```python
sp = pack.SpherePack()
sp.regularOrtho(
    pack.inAlignedBox((0, 0, 0), (0.1, 0.1, 0.1)),
    radius=0.005,
    gap=0.0001
)
```

正交堆积的排列模式：
- 颗粒沿三个坐标轴方向排列
- 形成简单的立方晶格
- 孔隙率较高

### 2.5 PSD（粒径分布）

#### 什么是 PSD？

粒径分布（Particle Size Distribution）描述了颗粒集合体中不同粒径
颗粒的比例关系。它是影响颗粒材料力学行为的关键因素之一。

常见的 PSD 表示方法：
- **级配曲线**（Grading Curve）：粒径 vs 小于该粒径的质量百分比
- **均匀系数** Cu = d60 / d10
- **曲率系数** Cc = (d30)² / (d10 × d60)

#### psd() 方法

YADE 的 `SpherePack.psd()` 方法用于设置或获取粒径分布：

```python
# 设置自定义 PSD
# psdSizes：粒径列表（从大到小排列）
# psdCumm：累积通过百分比（0 到 1）
sp.psd(
    sizes=[0.005, 0.003, 0.001],  # 粒径 [m]
    cumm=[0.0, 0.5, 1.0],         # 累积百分比
    mass=True                      # 基于质量的分布
)
```

#### 质量分布 vs 数量分布

- **质量分布**（mass-based）：指定每种粒径颗粒的质量百分比
- **数量分布**（number-based）：指定每种粒径颗粒的数量百分比

对于相同的质量分布，大颗粒数量少，小颗粒数量多。

```python
# 质量分布（更常用）
sp.psd(sizes=[0.005, 0.003, 0.001],
       cumm=[0.0, 0.5, 1.0],
       mass=True)

# 数量分布
sp.psd(sizes=[0.005, 0.003, 0.001],
       cumm=[0.0, 0.5, 1.0],
       mass=False)
```

#### 常见的 PSD 类型

1. **单分散**（Monodisperse）：所有颗粒粒径相同
   - 均匀系数 Cu = 1
   - 堆积密度较低（随机堆积约 64%）

2. **双分散**（Bidisperse）：两种粒径的颗粒混合
   - 大小颗粒的比例影响堆积密度
   - 当大小比约为 7:1 时，堆积密度最高

3. **连续级配**（Well-graded）：粒径连续分布
   - 均匀系数 Cu > 4
   - 堆积密度高

4. **间断级配**（Gap-graded）：缺少某些粒径范围
   - 存在明显的粒径"跳跃"
   - 用于模拟特定工程材料

### 2.6 堆积密度

#### relDensity() 方法

`SpherePack` 提供了 `relDensity()` 方法计算相对密度：

```python
# 计算相对密度（相对于最大理论密度）
rd = sp.relDensity()
print(f"相对密度: {rd:.4f}")
```

#### 孔隙率的计算

孔隙率（porosity）n 定义为：

```
n = V_void / V_total = 1 - V_solid / V_total
```

在 DEM 中的计算方法：

```python
# 方法 1：使用 SpherePack 计算
# 只需要知道颗粒总体积和容器体积
V_spheres = sum((4/3) * pi * r**3 for r in sp.radii())
V_container = ...  # 容器体积
porosity = 1 - V_spheres / V_container

# 方法 2：使用 YADE 的 Porosity 计算器
from yade import utils
porosity = utils.porosity()
```

#### 影响堆积密度的因素

1. **粒径分布**：多分散颗粒比单分散颗粒堆积更密
2. **颗粒形状**：非球形颗粒（如椭球）可以达到更高密度
3. **生成方法**：振动压实比自由沉积密度更高
4. **摩擦角**：摩擦角越小，沉积越紧密
5. **生成速率**：缓慢沉积比快速沉积更密实

### 2.7 GTS 表面

GTS（GNU Triangulated Surface）是一种用于定义三维表面的格式。
在 YADE 中，可以使用 GTS 表面定义复杂的几何边界，然后在该边界
内生成球体堆积。

#### 基本用法

```python
# 从 GTS 文件加载表面
surf = pack.gtsSurface2Facets('/path/to/surface.gts')

# 使用 GTS 表面作为谓词生成堆积
predicate = pack.inGtsSurface('/path/to/surface.gts')
sp = pack.randomDensePack(
    predicate,
    rMean=0.001,
    rRelFuzz=0.3
)
```

#### 创建简单 GTS 表面

```python
# 使用 YADE 内置函数创建常见几何形状
# 半球
surf = pack.gtsSurface2Facets(
    gts.Surface(
        # ... 定义顶点和面
    )
)
```

---

## 3. 代码逐行解析

### 3.1 导入与参数设置

```python
from yade import pack, plot, utils, qt
import numpy as np
import math
```

### 3.2 方法一：makeCloud 基础堆积

最简单的堆积生成方式：

```python
sp = pack.SpherePack()
sp.makeCloud((0, 0, 0), (0.1, 0.1, 0.1),
             rMean=0.005, rRelFuzz=0.3, num=500)
ids = sp.toSimulation()
```

### 3.3 方法二：randomDensePack 密实堆积

使用沉积法生成更紧密的堆积：

```python
sp = pack.randomDensePack(
    pack.inAlignedBox((0, 0, 0), (0.1, 0.1, 0.1)),
    rMean=0.005,
    rRelFuzz=0.3,
    spheresInVolume=500,
    memoizeDb='/tmp/packing.db'
)
```

### 3.4 方法三：regularHexa 规则堆积

```python
sp = pack.SpherePack()
sp.regularHexa(
    pack.inAlignedBox((0, 0, 0), (0.1, 0.1, 0.1)),
    radius=0.005, gap=0.0001
)
```

### 3.5 谓词布尔运算示例

```python
# 圆柱体减去中心圆柱体 = 空心圆柱
pred = pack.inCylinder((0, 0, 0), (0, 0, 0.1), 0.05) - \
       pack.inCylinder((0, 0, 0), (0, 0, 0.1), 0.02)
```

### 3.6 PSD 控制

```python
sp = pack.SpherePack()
sp.makeCloud((0, 0, 0), (0.1, 0.1, 0.1), num=1000, periodic=True)
# 应用自定义 PSD
sp.psd(sizes=[0.005, 0.003, 0.001, 0.0005],
       cumm=[0.0, 0.3, 0.7, 1.0],
       mass=True)
```

---

## 4. 物理背景与工程意义

### 4.1 堆积密度的工程意义

堆积密度直接影响颗粒材料的力学行为：
- **密实堆积**：剪切强度高，剪胀性显著，刚度大
- **松散堆积**：剪切强度低，可能液化，压缩性大

### 4.2 级配设计

在实际工程中，骨料的级配设计是混凝土和沥青混合料设计的核心：
- **连续级配**：最大密实度，常用于混凝土
- **间断级配**：特定力学性能，常用于排水基层
- **单一级配**：孔隙率大，常用于过滤层

### 4.3 DEM 中的堆积生成策略

选择合适的堆积生成方法取决于模拟目标：

| 场景 | 推荐方法 | 原因 |
|------|----------|------|
| 快速原型 | makeCloud | 速度快，参数简单 |
| 力学试验 | randomDensePack | 密实度高，物理合理 |
| 规则排列研究 | regularHexa/Ortho | 可控的初始状态 |
| 复杂几何 | randomDensePack + 谓词 | 灵活的边界形状 |

---

## 5. 练习题

### 练习 1：不同 PSD 的堆积密度

生成三种不同 PSD 的堆积，比较孔隙率：
- 单分散：所有颗粒半径相同
- 双分散：大小比 3:1，体积比 1:1
- 连续级配：均匀系数 Cu > 4

```python
# 单分散
sp1.makeCloud(minC, maxC, rMean=0.002, rRelFuzz=0, num=500)

# 双分散
sp2.makeCloud(minC, maxC, rMean=0.002, rRelFuzz=0.6, num=500)

# 连续级配
sp3.makeCloud(minC, maxC, rMean=0.002, rRelFuzz=0.8, num=500)
```

### 练习 2：谓词组合

使用谓词布尔运算创建以下形状内的堆积：
1. 空心球体：大球减去小球
2. L 形区域：两个长方体的并集
3. 带孔长方体：长方体减去圆柱体

### 练习 3：堆积密度优化

通过以下方法尝试提高 `makeCloud` 生成的堆积密度：
1. 减小摩擦角后再沉积
2. 使用振动压实（周期性压缩边界）
3. 使用 `randomDensePack` 替代 `makeCloud`

### 练习 4：保存与加载

练习 SpherePack 的保存和加载：
```python
# 保存
sp.save('/tmp/my_packing.txt')
sp.save('/tmp/my_packing.bin')  # 二进制格式更快

# 加载
sp2 = pack.SpherePack()
sp2.load('/tmp/my_packing.txt')
```

### 练习 5：圆柱体内的堆积

使用 `inCylinder` 谓词在圆柱体内生成堆积，并计算：
1. 孔隙率沿高度的分布
2. 配位数的分布
3. 与长方体区域堆积的对比

```python
# 圆柱体谓词
cyl_pred = pack.inCylinder(
    centerBottom=(0, 0, 0),   # 底面中心
    centerTop=(0, 0, 0.1),    # 顶面中心
    radius=0.03               # 半径
)
sp = pack.randomDensePack(cyl_pred, rMean=0.002, spheresInVolume=300)
```

### 练习 6：周期性 vs 非周期性堆积

比较周期性和非周期性堆积的差异：
```python
# 周期性堆积
sp_peri.makeCloud(minC, maxC, rMean=0.002, num=500, periodic=True)

# 非周期性堆积
sp_nonp.makeCloud(minC, maxC, rMean=0.002, num=500, periodic=False)
```

观察：
- 边界处颗粒的排列差异
- 孔隙率的差异
- 在力学加载中边界效应的表现

---

## 6. 参考文献

1. Šmilauer, V. et al. (2022). *Yade Documentation* — Packing module. https://yade-dem.org/doc/
2. Torquato, S. (2002). *Random Heterogeneous Materials: Microstructure and Macroscopic Properties*. Springer.
3. Donev, A. et al. (2004). Improving the density of jammed disordered packings using ellipsoids. *Science*, 303(5660), 990-993.
4. Furnas, C.C. (1931). Grading aggregates. *Industrial & Engineering Chemistry*, 23(10), 1052-1058.
5. German, R.M. (1989). *Particle Packing Characteristics*. Metal Powder Industries Federation.
6. Aste, T. & Weaire, D. (2008). *The Pursuit of Perfect Packing*. CRC Press.

---

## 7. 进阶阅读

- 使用本项目的堆积进行力学试验，参见项目 `03_oedometric_test` 和 `06_triaxial_test`
- 周期性边界条件下的堆积生成，参见项目 `04_periodic_shear`
- 非球形颗粒（clump）的堆积，参见项目 `08_clumps_breakage`
