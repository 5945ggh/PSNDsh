# 季节名句数据包

## 目标与边界

名句展示只读取随应用发布的本地 JSON 数据包，不在用户请求链路中抓取网页。当前内置四个季节包位于 `content/quotations/`，人工审核内容和未来受控预抓取产物都必须遵循本格式。

应用按 `APP_TIMEZONE` 中的当前月份选择对应季节包，再从可用候选中按日期稳定选择一条。相同日期、时区和数据包版本得到相同结果，避免页面刷新时名句无意义跳变；不同日期会自然轮换。

## 文件布局

```text
content/quotations/
  spring.json
  summer.json
  autumn.json
  winter.json
```

每个季节一个 UTF-8 JSON 文件。四个文件都必须存在，且使用相同的 `catalogVersion`。

## `1.0` 格式

```json
{
  "schemaVersion": "1.0",
  "catalogVersion": "2026.07.23.manual.1",
  "season": "spring",
  "months": [3, 4, 5],
  "quotations": [
    {
      "id": "spring-rain",
      "text": "好雨知时节，当春乃发生。",
      "author": "杜甫",
      "work": "《春夜喜雨》",
      "sourceUrl": "https://www.gushiwen.cn/...",
      "months": [3, 4]
    }
  ]
}
```

字段规则：

- `schemaVersion`：当前固定为 `1.0`；格式变化时必须新增版本并同步解析器。
- `catalogVersion`：一次内容发布的版本号；四个季节文件必须相同，建议使用日期和来源标识。
- `season`：只能是 `spring`、`summer`、`autumn`、`winter`，四个文件不可重复。
- `months`：该季节包覆盖的 1-12 月份；四个数据包合起来必须覆盖全部月份且不能重复。
- `quotations[].id`：在本季节包内唯一、稳定且不可因文案微调随意改变。
- `text`、`author`、`work`：均为非空人工审核文本。
- `sourceUrl`：作品级公开来源 URL；初始人工包可暂用来源站点地址，但受控预抓取上线时必须补齐作品级 URL。
- `quotations[].months`：可选。省略时覆盖包的全部月份；提供后必须是该包月份的子集，用于更细的月度选择。

## 发布检查

提交数据包前运行 `corepack pnpm test`。运行时解析会拒绝未知字段、空文本、非法 URL、重复 ID、季节缺失或跨包版本不一致。预抓取 Agent 只能生成候选 JSON；内容、来源许可和版本号仍需人工审核后才能提交。
