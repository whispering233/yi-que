"use client";

import { Alert, Button, Card, Divider, Flex, Space, Tag, Typography } from "antd";

const { Title, Paragraph, Text } = Typography;

/**
 * 基座验证页（任务卡 1）
 *
 * 目的：验证 Next.js 静态导出 + antd v6 + Tailwind 这条链路成立。
 * 验证方式不是「页面看起来对」，而是构建产物里确实含有 antd 抽取出的样式
 * （见 out/index.html 中的 antd 样式片段）。
 *
 * 真实页面由任务卡 15–18 交付。
 */
export default function Home() {
  return (
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

      {/* antd 组件渲染验证 */}
      <Card title="antd v6 渲染验证" size="small">
        <Flex vertical gap="middle">
          <Space wrap>
            <Button type="primary">主操作</Button>
            <Button>次操作</Button>
            <Button type="text">文字按钮</Button>
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
          <Text>
            这些组件的外观完全来自 antd 的 CSS-in-JS。若它们在静态产物中无样式（裸 DOM
            观感），说明样式抽取失败——这正是本卡要排查的风险。
          </Text>
        </Flex>
      </Card>

      {/* Tailwind 布局 + 响应式验证 */}
      <Card title="Tailwind 布局与断点验证" size="small">
        <Flex vertical gap="middle">
          <Text type="secondary">
            下列卡片在窄屏为单列、中屏两列、宽屏四列；当前生效的断点档位会高亮。
          </Text>
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
          <Space wrap>
            <Tag className="sm:hidden">基础 &lt; 640px</Tag>
            <Tag className="hidden sm:inline-flex md:hidden">sm ≥ 640px</Tag>
            <Tag className="hidden md:inline-flex lg:hidden">md ≥ 768px</Tag>
            <Tag className="hidden lg:inline-flex xl:hidden">lg ≥ 1024px</Tag>
            <Tag className="hidden xl:inline-flex">xl ≥ 1280px</Tag>
          </Space>
        </Flex>
      </Card>

      <footer className="text-center">
        <Text type="secondary" className="text-xs">
          设计文档与数据来源见仓库 docs/ 目录
        </Text>
      </footer>
    </main>
  );
}
