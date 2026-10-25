# 增长天王原创透明配件 v1

- 生成日期：2026-10-11；工具：内置 imagegen，`transparent_background: true`。
- 生成文件已逐字节复制为 `zengzhang-parts-v1.png`，1254×1254、8 位 RGBA。未修改、抠图或重写 PNG 像素。
- SHA-256：`7594f4aa9b3346397bae592e618fac75e1ba83ae92952a96ed714a2d3aacc8d8`；与工具原始文件一致。
- 本项目原创风格参考：`assets/art/wukong-parts-v1.png`、`assets/art/characters/heaven-enemy-parts-v1.png`。两者只用于绘画风格和光线参考。
- 图集含静态守势人脸、战斗人脸、蓝金云纹鳞甲、独立腰封裙甲。完整生成提示词、源矩形见同名 `.sources.json`。
- 不使用原作像素、原作贴图或第三方角色素材。动态护臂、靴、拳、宝剑与云纹披风由本项目 Canvas 几何绘制。
- alpha=0 像素占 51.58%；画面内部的生成 alpha 大多为 252–253，保持工具原样，没有强制转为不透明。
- 下排甲胄和裙甲包围盒有约 10px 的横向交叠：运行时在各自源矩形采样后使用 Canvas clip 排除邻件；保留原始透明图集。
