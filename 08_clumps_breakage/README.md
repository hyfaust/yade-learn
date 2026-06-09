# 08 团簇与破碎 —— 非球形颗粒与颗粒破碎

## 1. 项目简介

自然界中的颗粒材料很少是完美球形的。砾石、碎石、矿物颗粒等都呈现出不规则的形状。
使用球形颗粒来近似这些不规则形状，会导致以下问题：

- 旋转阻力不足：球体可以自由滚动，而真实颗粒由于形状不规则会相互"锁死"
- 抗剪强度偏低：形状不规则的颗粒之间更容易形成互锁结构
- 力链分布差异：非球形颗粒形成的力链网络与球形颗粒显著不同

在本项目中，我们将学习 YADE 中的 **Clump**（团簇）技术来创建非球形颗粒，以及
如何模拟颗粒的**破碎**行为。

通过本教程，你将掌握：
- Clump 的概念和创建方法
- 各种 Clump 形状的设计（哑铃形、L 形、三角形等）
- Clump 的惯性张量计算
- Clump 堆积的生成和压缩试验
- 颗粒破碎的模拟方法（Clump → 独立球体的替换）

---

## 2. 核心概念详解

### 2.1 Clump 概念

**Clump**（团簇）是 YADE 中的一种刚体，由多个**重叠**的球体组成。与普通球体
不同，Clump 中的球体之间没有接触——它们作为一个整体运动。

#### 2.1.1 Clump 与普通球体的区别

| 特性 | 单个球体 | Clump |
|------|----------|-------|
| 形状 | 完美球形 | 任意（由多个球组合） |
| 自由度 | 6 (3 平移 + 3 旋转) | 6 (3 平移 + 3 旋转) |
| 滚动阻力 | 无（需额外模型） | 天然具有（形状效应） |
| 碰撞检测 | 球-球接触 | 组成球体之间的接触 |
| 计算成本 | 低 | 较高 |
| 物理真实性 | 简单，适合快速计算 | 更接近真实颗粒 |

#### 2.1.2 Clump 的运动学

Clump 作为一个刚体运动，所有成员球体跟随整体的平移和旋转：

每个成员球体的位置：

$$r_i = R + Q \times r_{\text{local},i}$$

其中：
- $R$ = Clump 质心的全局位置
- $Q$ = Clump 的旋转四元数
- $r_{\text{local},i}$ = 成员球体相对于质心的局部坐标（在 Clump 局部坐标系中）

Clump 的速度和角速度：
$$v_i = V + \omega \times (r_i - R)$$

其中 $V$ = 质心线速度，$\omega$ = 角速度

### 2.2 创建 Clump

#### 2.2.1 使用 appendClumped()

`O.bodies.appendClumped()` 是创建 Clump 的基本方法。它接受一个列表，列表中
包含组成 Clump 的成员球体。

```python
# 方法 1：直接用 appendClumped 创建
# 定义成员球体的位置和半径
# (位置, 半径) 的列表
members = [
    ([0, 0, -0.5], 0.5),    # 下球：中心在 (0,0,-0.5)，半径 0.5
    ([0, 0,  0.5], 0.5),    # 上球：中心在 (0,0, 0.5)，半径 0.5
]

# appendClumped 返回 Clump 的 body ID 和成员球体的 body ID
clumpId, memberIds = O.bodies.appendClumped([
    sphere(pos, radius) for pos, radius in members
])
```

#### 2.2.2 Clump 模板

对于需要批量创建相同形状 Clump 的情况，可以使用 **Clump 模板**：

```python
# 定义模板：(相对位置, 相对半径) 的列表
# 相对位置和半径是相对于"单位大小"的
template = [
    ([0, 0, -0.5], 0.5),    # 下球
    ([0, 0,  0.5], 0.5),    # 上球
]

# 使用模板在指定位置创建 Clump
# size 参数缩放模板的所有尺寸
clumpId = O.bodies.appendClumped([
    sphere(Vector3(pos) * size + center, radius * size)
    for pos, radius in template
])
```

#### 2.2.3 常见 Clump 形状

**哑铃形 (Dumbbell)**：
```python
# 两个球体沿一条轴线排列
dumbbell = [
    ([0, 0, -0.5], 0.5),   # 球 1
    ([0, 0,  0.5], 0.5),   # 球 2
]
```

**L 形**：
```python
# 两个球体呈直角排列
lShape = [
    ([0, 0, 0], 0.5),       # 角部
    ([1, 0, 0], 0.5),       # 水平臂
    ([0, 0, 1], 0.5),       # 垂直臂
]
```

**三角形**：
```python
# 三个球体呈等边三角形排列
import math
triangle = [
    ([0, 0, 0], 0.5),
    ([1, 0, 0], 0.5),
    ([0.5, math.sqrt(3)/2, 0], 0.5),
]
```

**四面体**：
```python
# 四个球体呈四面体排列
import math
tetra = [
    ([0, 0, 0], 0.5),
    ([1, 0, 0], 0.5),
    ([0.5, math.sqrt(3)/2, 0], 0.5),
    ([0.5, math.sqrt(3)/6, math.sqrt(6)/3], 0.5),
]
```

### 2.3 惯性张量

#### 2.3.1 质量计算

Clump 的总质量是所有成员球体质量之和：

$$m = \sum_i \rho_i \times \frac{4}{3} \cdot \pi \cdot r_i^3$$

#### 2.3.2 转动惯量计算

Clump 的转动惯量通过**平行轴定理**计算。对于每个成员球体，先计算其对自身中心的
惯性张量，然后平移到 Clump 的质心：

$$I_{\text{clump}} = \sum_i \left[ I_i + m_i \times (d_i^2 \cdot E - d_i \otimes d_i) \right]$$

其中：
- I_i = (2/5) × m_i × r_i² × E 是球体的自身惯性张量
- d_i = r_i - R 是球体中心到 Clump 质心的向量
- E 是单位矩阵
- ⊗ 是外积

YADE 自动完成这个计算，用户不需要手动计算。

#### 2.3.3 惯性张量的物理意义

惯性张量描述了 Clump 对旋转的抵抗能力。对于非球形 Clump：
- 三个主惯性矩通常不相等
- 这导致 Clump 绕不同轴旋转的行为不同
- 这正是非球形颗粒"旋转阻力"的物理来源

### 2.4 非球形动力学

#### 2.4.1 旋转积分算法

YADE 提供了三种旋转积分算法：

| 算法 | 特点 | 适用场景 |
|------|------|----------|
| **Spiral** | 简单高效 | 一般用途 |
| **Omelyan** | 更精确的四元数积分 | 需要精确旋转的场景 |
| **Fincham** | 最优的精度/成本比 | 大多数 Clump 模拟 |

在 NewtonIntegrator 中设置：

```python
NewtonIntegrator(
    rotIntegrator='Spiral',  # 或 'Omelyan', 'Fincham'
    ...
)
```

#### 2.4.2 旋转阻尼

对于 Clump 模拟，可能需要额外的旋转阻尼来控制颗粒的旋转动能：

```python
NewtonIntegrator(
    damping=0.2,              # 线性阻尼
    ...
)
```

### 2.5 颗粒破碎

颗粒破碎是岩土工程和采矿业中的重要现象。在 DEM 中，有多种方法来模拟破碎：

#### 2.5.1 替换法 (Replacement Method)

最直观的方法：当 Clump 上的力超过阈值时，将 Clump 替换为多个独立的小球体。

**步骤**：
1. 监测每个 Clump 上的接触力
2. 当力超过强度阈值时，删除 Clump
3. 在相同位置创建独立的成员球体
4. 成员球体继承 Clump 的速度和角速度

**优点**：简单直接
**缺点**：破碎是突然的（非渐进的）

#### 2.5.2 粘结法 (Bonded Particle Model)

使用 Cpm 或类似的粘结模型将成员球体粘结在一起。当粘结力超过阈值时，粘结断裂，
Clump 自然"解体"。

**优点**：渐进破碎，更接近物理真实
**缺点**：计算成本更高，需要调更多参数

#### 2.5.3 破碎判据

常见的破碎判据包括：

- **力判据**：当 Clump 上的最大接触力超过 F_break
- **应力判据**：当 Clump 内部等效应力超过强度
- **能量判据**：当输入能量超过断裂能
- **概率判据**：力越大，破碎概率越高（统计方法）

### 2.6 Clump vs 球体的适用场景

| 场景 | 推荐 | 原因 |
|------|------|------|
| 快速原型验证 | 球体 | 计算快 |
| 堆积密度研究 | Clump | 形状影响大 |
| 旋转行为重要 | Clump | 天然旋转阻力 |
| 流变学研究 | Clump | 更接近真实 |
| 破碎模拟 | Clump | 必需 |
| 大规模模拟 | 球体 | 计算效率 |
| 管道流动 | 球体 | 接触检测简单 |

### 2.7 实际应用

Clump 技术在以下领域有广泛应用：

- **岩土工程**：模拟碎石、砾石、角砾等不规则骨料
- **采矿工程**：模拟矿石破碎过程
- **农业工程**：模拟谷物、种子等生物颗粒
- **制药工业**：模拟药片、颗粒剂
- **地质学**：模拟火山碎屑流、滑坡体

---

## 3. 代码逐行解析

### 3.1 Clump 形状定义

```python
# 定义三种 Clump 形状模板
# 每个模板是一个 (相对位置, 相对半径) 的列表

# 哑铃形：两个球体沿 z 轴排列
dumbbellTemplate = [
    ([0, 0, -0.4], 0.5),
    ([0, 0,  0.4], 0.5),
]
```

两个球体重叠部分越少，Clump 越"细长"；重叠越多，越接近球形。

### 3.2 Clump 生成与堆积

使用循环批量创建 Clump，并通过重力沉积形成堆积：

```python
for i in range(numClumps):
    # 随机位置
    pos = Vector3(randomPos)
    # 随机选择模板
    template = random.choice(templates)
    # 随机缩放
    size = random.uniform(minSize, maxSize)
    # 创建 Clump
    ...
```

### 3.3 破碎模拟

破碎的核心逻辑：

```python
def checkBreakage():
    for b in O.bodies:
        if not isinstance(b.shape, Clump):
            continue
        # 计算 Clump 上的总力
        totalForce = O.forces.f(b.id).norm()
        # 与破碎阈值比较
        if totalForce > breakForce:
            replaceClumpWithSpheres(b)
```

### 3.4 Clump 到独立球体的替换

```python
def replaceClumpWithSpheres(clumpBody):
    # 获取 Clump 的位置、速度、角速度
    pos = clumpBody.state.pos
    vel = clumpBody.state.vel
    angVel = clumpBody.state.angVel
    ori = clumpBody.state.ori

    # 删除 Clump
    O.bodies.erase(clumpBody.id)

    # 创建独立的成员球体
    for localPos, radius in clumpMembers:
        # 将局部坐标转换为全局坐标
        globalPos = pos + ori * Vector3(localPos)
        # 计算成员球体的速度（线速度 + 旋转贡献）
        memberVel = vel + angVel.cross(Vector3(localPos))
        # 创建球体
        newId = O.bodies.append(sphere(globalPos, radius))
        O.bodies[newId].state.vel = memberVel
```

---

## 4. 运行与观察

### 4.1 运行方法

```bash
cd 08_clumps_breakage
yadedaily clumps_breakage.py
```

### 4.2 预期结果

1. **Clump 生成阶段**：各种形状的 Clump 在空中下落
2. **沉积阶段**：Clump 堆积在容器底部，形成互锁结构
3. **压缩阶段**：顶部墙向下移动，Clump 受到压缩
4. **破碎阶段**：部分 Clump 在高力作用下破碎，释放出小球体

### 4.3 观察要点

- 非球形 Clump 的堆积孔隙率通常高于球形颗粒
- Clump 在压缩时表现出更强的抗剪强度（互锁效应）
- 破碎后，碎片（小球体）填充到空隙中，改变力链分布

---

## 5. 练习题

### 练习 1：不同 Clump 形状

设计 3 种以上不同的 Clump 形状（如十字形、星形、链式），分别生成堆积并对比
堆积密度。

### 练习 2：旋转行为观察

在倾斜平面上放置单个 Clump 和单个球体，观察它们的运动差异。Clump 是否表现出
更强的滚动阻力？

### 练习 3：破碎阈值研究

修改破碎力阈值，观察不同阈值下：
- 破碎发生的频率
- 最终颗粒级配的变化
- 力-位移曲线的差异

### 练习 4：Clump 模板系统

使用 Clump 模板（相对位置和相对半径）设计一套可以参数化生成不同形状的系统。
例如，通过调整球体间距参数来控制 Clump 的长宽比。

---

## 6. 延伸阅读

- [YADE 宙方文档 — Clump](https://yade-dem.org/doc/yade.wrapper.html#yade.wrapper.Clump)
- [YADE 宙方文档 — Clump 模板](https://yade-dem.org/doc/tutorial-clumps.html)
- Potapov, A.V. & Campbell, C.S. (1997). Computer simulation of hopper flow and fracture of glass beads. Powder Technology, 93(3), 249-262.
- Cho, G.C., Dodds, J. & Santamarina, J.C. (2006). Particle shape effects on packing density, stiffness, and strength: natural and crushed sands. J. Geotech. Geoenviron. Eng., 132(5), 591-602.
- Favier, J.F. et al. (1999). Industrial application of the DEM, from powder to granular materials. Chemical Engineering Science, 54(13-14), 1957-1964.

---

**上一课**：[07 混凝土力学](../07_concrete_mechanics/) —— 学习 Cpm 模型模拟混凝土。

**下一课**：[09 流固耦合](../09_fluid_coupling/) —— 学习 DEM 与流体的耦合模拟。
