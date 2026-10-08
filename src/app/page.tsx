"use client";

import { Alert, Button, Card, Divider, Flex, Space, Tag, Typography } from "antd";
import { AntdProvider } from "@/ui/antd-provider";
import { BREAKPOINTS } from "@/ui/tokens";
import { useBreakpoint } from "@/ui/use-breakpoint";

const { Title, Paragraph, Text } = Typography;

const TIERS = ["base", ...Object.keys(BREAKPOINTS)] as const;

/**
 * 基座验证页（任务卡 1、2）
 *
 * 验证的是机制成立，不是页面好看：
 *   1. 静态导出下 antd 的样式被构建期完整抽取
 *   2. 设计令牌单点生效（改 tokens.ts 一处，全站跟随）
 *   3. 断点单一来源（Tailwind 与 JS 侧判定始终一致）
 *
 * 真实页面由任务卡 15–18 交付。
 */
export default function Home() {
  const hit = useBreakpoint();

  return (
    <AntdProvider>
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 md:px-6 lg:py-16">
      <header className="flex flex-col gap-2">
        <Title level={1} className="!mb-0">
          一阕
        </Title>
        <Paragraph className="!mb-0">
          <Text type="secondary">宋词的创作、鉴赏与交流平台</Text>
        </Paragraph>
      </header>

      <Alert
        type="info"
        showIcon
        message="项目状态"
        description="设计阶段已完成，代码正在建设中。本页是基座验证页，不是最终首页。"
      />

      <Card title="设计令牌：单点生效" size="small">
        <Flex vertical gap="middle">
          <Text type="secondary">
            下列组件的外观全部来自 antd 的 seed token，而 seed token 只定义在
            <Text code>src/ui/tokens.ts</Text> 一处。改那里的
            <Text code>colorPrimary</Text>，本页所有主色元素同步变化。
          </Text>
          <Space wrap>
            <Button type="primary">主操作</Button>
            <Button>次操作</Button>
            <Button type="link">链接按钮</Button>
            <Button disabled>禁用</Button>
          </Space>
          <Space wrap>
            <Tag color="default">默认</Tag>
            <Tag color="processing">处理中</Tag>
            <Tag color="success">成功</Tag>
            <Tag color="warning">警告</Tag>
            <Tag color="error">错误</Tag>
          </Space>
          <Divider className="!my-0" />
          <Text type="secondary" className="text-xs">
            主色应为朱砂 <Text code>#8c3a2b</Text>，页面底色应为宣纸白
            <Text code>#fdfcfa</Text>。若仍是 antd 默认蓝，说明令牌没接上。
          </Text>
        </Flex>
      </Card>

      <Card title="断点：单一来源" size="small">
        <Flex vertical gap="middle">
          <Text type="secondary">
            断点只定义在 <Text code>src/ui/tokens.ts</Text> 一处。Tailwind 从
            <Text code>globals.css</Text> 的镜像取值（有护栏测试断言两侧一致），
            JS 侧走 <Text code>useBreakpoint</Text>。下面两行必须始终指向同一档位。
          </Text>

          {/*
            Tailwind 工具类必须放在**原生元素**上：antd 组件的样式未分层，
            而 Tailwind v4 的工具类在 @layer utilities 里，未分层样式优先级更高。
            直接写在 antd 组件上的 layout 类会被它自己的样式盖掉（实测 hidden 失效）。
            见 docs/design/architecture.md 的「样式层叠」节。
          */}
          <Flex align="center" gap="small" wrap>
            <span className="w-24 shrink-0">
              <Text className="text-xs">Tailwind</Text>
            </span>
            <Space wrap size={4}>
              <span className="sm:hidden">
                <Tag>base</Tag>
              </span>
              <span className="hidden sm:inline-block md:hidden">
                <Tag>sm</Tag>
              </span>
              <span className="hidden md:inline-block lg:hidden">
                <Tag>md</Tag>
              </span>
              <span className="hidden lg:inline-block xl:hidden">
                <Tag>lg</Tag>
              </span>
              <span className="hidden xl:inline-block 2xl:hidden">
                <Tag>xl</Tag>
              </span>
              <span className="hidden 2xl:inline-block">
                <Tag>2xl</Tag>
              </span>
            </Space>
          </Flex>

          {/* JS 判定：matchMedia 消费同一常量 */}
          <Flex align="center" gap="small" wrap>
            <span className="w-24 shrink-0">
              <Text className="text-xs">useBreakpoint</Text>
            </span>
            <Space wrap size={4}>
              {TIERS.map((t) => (
                <Tag key={t} color={t === hit ? "processing" : "default"}>
                  {t}
                </Tag>
              ))}
            </Space>
          </Flex>

          <Text type="secondary" className="text-xs">
            两行高亮的档位不一致即为漂移。断点值与含义见
            <Text code>docs/design/30-web-app.md</Text>。
          </Text>
        </Flex>
      </Card>

      <Card title="响应式布局" size="small">
        <Flex vertical gap="middle">
          <Text type="secondary">窄屏单列、中屏两列、宽屏四列。</Text>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {["一", "二", "三", "四"].map((n) => (
              <div
                key={n}
                className="rounded border border-solid border-neutral-200 px-3 py-6 text-center"
              >
                <Text>{n}</Text>
              </div>
            ))}
          </div>
        </Flex>
      </Card>

      <div className="text-center">
        <Text type="secondary" className="text-xs">
          设计文档与数据来源见仓库 docs/ 目录
        </Text>
      </div>
    </main>
    </AntdProvider>
  );
}
