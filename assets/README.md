# 原创素材

全部资源为本项目制作，未提取《造梦西游》的图画、录音或旋律；运行时无需联网或生成工具。

## 美术

通过内置 imagegen 生成，原始输出直接复制到 `art/`，透明 PNG 保留原始 alpha；完整生成提示词保存在 [art/prompts.json](art/prompts.json)。

| 文件 | 用途 |
| --- | --- |
| `nantian-cloud-city.png` | 16:9 天宫、浮岛与云海远景，慢速视差 |
| `nantian-veranda.png` | 透明庭院长廊，红柱、金瓦、玉石台基 |
| `nantian-gate.png` | 透明南天门门阙，包含开放门洞及匾额 |
| `wukong-parts-v1.png` | 悟空透明绘画图集：四种表情、胸甲、虎皮裙、靴、金箍棒、上臂、护臂、拳与披风 |
| `scenes/pantao-garden-v1.png` | 蟠桃园3:1绘画宽景：桃林、月门、亭阁、悬山与云海 |
| `characters/zengzhang-parts-v1.png` | 增长天王透明零件：守势/战斗冠脸、蓝金胸甲与腰甲 |

提示词方向：原创西游 Q 版手绘赛璐璐场景，金瓦红柱、青玉云纹、暖晨光；天空/门阙/庭院分开生成，建筑开口真实透明，没有角色、游戏界面或原作素材。云桥、栏杆、动态薄云及可站云台由 Canvas 补充。

悟空图集由内置 imagegen 生成，1448×1086 RGBA，保留原始像素和透明度，通过 Canvas source rect 取用零件。完整提示词、裁框与来源在 [art/wukong-parts-v1.json](art/wukong-parts-v1.json)。四头像使用同一裁框尺寸和颈部锚点，表情切换不单独拉伸；躯干、肢体、拳与武器跟随程序骨架。披风绘画纹理填入动态轮廓，尾巴继续曲线绘制。图片缺失时回退原程序化角色；角色装备数值照常生效，外观使用这套固定大圣造型。

火眼金睛、筋斗云、七十二斩与无双的火焰、祥云、棍影和冲击云浪均由 Canvas 实时绘制，柔光仅生成两张小缓存图；没有新增第三方运行库。

蟠桃园和增长天王由内置 imagegen 为本项目制作，原 PNG 直接复制并保留像素及透明度。完整提示词、原始输出、图集框与参考来源分别保存在 [场景来源](art/scenes/pantao-garden-v1.sources.json) 和 [角色来源](art/characters/zengzhang-parts-v1.sources.json)。参考图仅使用本项目原创素材；场景下方玉石行走面、可站平台，角色肢体、宝剑及动态披风继续由 Canvas 绘制。两项素材独立加载，失败各自回退，不依赖联网。

v67 增加凌霄庭院、天宫殿堂、东海海岸、海底龙宫、火焰山和洞府六张原创 2172×724 宽景，覆盖其余主线及镇妖塔。原 PNG 无二次像素修改；不同地点使用独立取景、气氛和准确的 Canvas 地面/平台。尺寸、散列与来源在 [全章节场景来源](art/scenes/complete-chapters-v1.sources.json)，该批精确原始提示词未保留，已如实标注。

后八位首领使用 [原创头部与胸甲图集](art/characters/journey-boss-parts-v1.sources.json)，按真实招式时钟驱动头身、关节、握持武器和收势。虾兵、火妖等后续杂兵使用 [三张原创杂兵部件图集](art/characters/journey-enemies-v1.sources.json) 与各自骨架；[弓手和牛妖图集](art/characters/archer-bull-parts-v1.sources.json) 补齐其头部与胸甲，保留拉弓、放箭和挥斧动作。以上均由 imagegen 为本项目生成，保留原 PNG 和完整提示词；Canvas 补足四肢、武器、触须与动作，加载失败沿用相同动作的 Q 版程序造型。

## 音乐

原创曲《云阙行》，由 `tools/build_nantian_music.py` 离线合成。笛箫、弹拨和鼓为代码合成音色，非真实乐器录音。曲式为主句、应答、行动展开和回归，每段八小节；极轻的带限合成气流与每八小节一次的金石远钟衬托云海气氛，非真实环境录音，相对电平记录于音乐 JSON。

| 文件 | 时长 | 用途 |
| --- | --- | --- |
| `nantian_adventure.ogg` / `.wav` | 76.8 秒 | 100 BPM 冒险曲，OGG 用于游戏、WAV 为母版 |
| `nantian_boss.ogg` / `.wav` | 68.571 秒 | 112 BPM 同主题 Boss 变奏 |
| `nantian_preview.wav` | 26 秒 | 有独立起收的试听样段 |
| `nantian_music.json` | — | 编排、采样率、来源与生成参数 |

32 kHz、立体声。合成母版峰值 0.72，无削波；完整曲的混响和音符尾音跨循环边界累加。播放走本地 HTMLAudioElement，音效保留 WebAudio；资源缺失或解码失败时切回内置曲。

重制音乐需要 Python、NumPy、SciPy、FFmpeg；游戏本身不需要这些工具。图片原始输出保留在 Codex 的 generated_images 目录，项目运行只引用本目录副本。

v67 新增《问天路》《云阙行·行阵》《碧潮寻珠》与《踏焰西行》系列，六首主题/冒险/Boss循环由 `tools/build_chapter_music.py` 以固定种子合成，使用原创合成笛箫、弹拨、鼓与铺底。游戏只读取 OGG；同名 WAV 为母版，`chapter_*_audition.wav` 和 `chapter_loop_seams.wav` 为离线检查片段。完整曲式、时长、峰值、RMS与循环端点分析在 [章节音乐来源](audio/chapter_music.json)，制作及静音验收限制见 [音乐记录](../docs/complete-music-status.md)。未加入真实乐器录音或第三方采样。
