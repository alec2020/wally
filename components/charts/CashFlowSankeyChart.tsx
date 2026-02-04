'use client';

import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Sankey, Tooltip, Rectangle } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getCategoryColor, formatCurrency } from '@/lib/utils';

interface CashFlowSankeyChartProps {
  spendingByCategory: { category: string; total: number }[];
  savingsRate: { income: number; expenses: number; saved: number };
}

interface SankeyNodePayload {
  name: string;
  color: string;
  value?: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  depth: number;
}

interface SankeyLinkPayload {
  source: number;
  target: number;
  value: number;
  sy: number;
  ty: number;
  dy: number;
  sourceX?: number;
  sourceY?: number;
  sourceControlX?: number;
  targetX?: number;
  targetY?: number;
  targetControlX?: number;
  linkWidth?: number;
  payload?: {
    source: number;
    target: number;
    value: number;
    color: string;
  };
}

const MERGE_THRESHOLD = 0.02; // 2% of income

function CustomNode({ x, y, dx, dy, payload }: {
  x: number;
  y: number;
  dx: number;
  dy: number;
  payload: SankeyNodePayload;
}) {
  const isLeft = payload.depth === 0;
  return (
    <g>
      <Rectangle
        x={x}
        y={y}
        width={dx}
        height={dy}
        fill={payload.color}
        radius={[3, 3, 3, 3]}
      />
      <text
        x={isLeft ? x - 8 : x + dx + 8}
        y={y + dy / 2}
        textAnchor={isLeft ? 'end' : 'start'}
        dominantBaseline="central"
        className="fill-foreground"
        fontSize={13}
        fontWeight={500}
      >
        {payload.name}
      </text>
      <text
        x={isLeft ? x - 8 : x + dx + 8}
        y={y + dy / 2 + 16}
        textAnchor={isLeft ? 'end' : 'start'}
        dominantBaseline="central"
        className="fill-muted-foreground"
        fontSize={11}
      >
        {formatCurrency(payload.value ?? 0)}
      </text>
    </g>
  );
}

function CustomLink(props: SankeyLinkPayload) {
  const {
    sourceX = 0,
    sourceY = 0,
    sourceControlX = 0,
    targetX = 0,
    targetY = 0,
    targetControlX = 0,
    linkWidth = 0,
    payload,
  } = props;
  const color = payload?.color ?? '#94a3b8';
  const [hovered, setHovered] = useState(false);
  return (
    <path
      d={`
        M${sourceX},${sourceY + linkWidth / 2}
        C${sourceControlX},${sourceY + linkWidth / 2}
          ${targetControlX},${targetY + linkWidth / 2}
          ${targetX},${targetY + linkWidth / 2}
        L${targetX},${targetY - linkWidth / 2}
        C${targetControlX},${targetY - linkWidth / 2}
          ${sourceControlX},${sourceY - linkWidth / 2}
          ${sourceX},${sourceY - linkWidth / 2}
        Z
      `}
      fill={color}
      fillOpacity={hovered ? 0.45 : 0.25}
      stroke={color}
      strokeOpacity={hovered ? 0.6 : 0.35}
      strokeWidth={1}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ transition: 'fill-opacity 150ms, stroke-opacity 150ms' }}
    />
  );
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { payload?: { sourceName?: string; targetName?: string; value?: number } } }> }) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload?.payload;
  if (!data) return null;

  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm">
      <div className="font-medium">{data.sourceName} → {data.targetName}</div>
      <div className="text-muted-foreground">{formatCurrency(data.value ?? 0)}</div>
    </div>
  );
}

export function CashFlowSankeyChart({ spendingByCategory, savingsRate }: CashFlowSankeyChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const sankeyData = useMemo(() => {
    const income = savingsRate.income;
    if (income <= 0) return null;

    // Build expense categories, sorted by absolute value descending
    const expenses = spendingByCategory
      .filter((c) => c.total < 0)
      .map((c) => ({ name: c.category, value: Math.abs(c.total) }))
      .sort((a, b) => b.value - a.value);

    // Merge small categories into "Other"
    const threshold = income * MERGE_THRESHOLD;
    const significant: { name: string; value: number }[] = [];
    let otherTotal = 0;

    for (const exp of expenses) {
      if (exp.value >= threshold) {
        significant.push(exp);
      } else {
        otherTotal += exp.value;
      }
    }
    if (otherTotal > 0) {
      significant.push({ name: 'Other', value: otherTotal });
    }

    // Build nodes: [Income, ...categories, Savings?]
    const nodes: { name: string; color: string }[] = [
      { name: 'Income', color: getCategoryColor('Income') },
    ];

    for (const cat of significant) {
      nodes.push({ name: cat.name, color: getCategoryColor(cat.name) });
    }

    const saved = savingsRate.saved;
    const hasSavings = saved > 0;
    if (hasSavings) {
      nodes.push({ name: 'Savings', color: '#10b981' });
    }

    // Build links: Income (index 0) → each target
    const links: { source: number; target: number; value: number; color: string; sourceName: string; targetName: string }[] = [];

    for (let i = 0; i < significant.length; i++) {
      const targetIndex = i + 1; // offset by 1 for Income node
      links.push({
        source: 0,
        target: targetIndex,
        value: significant[i].value,
        color: getCategoryColor(significant[i].name),
        sourceName: 'Income',
        targetName: significant[i].name,
      });
    }

    if (hasSavings) {
      links.push({
        source: 0,
        target: nodes.length - 1,
        value: saved,
        color: '#10b981',
        sourceName: 'Income',
        targetName: 'Savings',
      });
    }

    if (links.length === 0) return null;

    return { nodes, links };
  }, [spendingByCategory, savingsRate]);

  const renderNode = useCallback((props: Record<string, unknown>) => {
    return (
      <CustomNode
        x={props.x as number}
        y={props.y as number}
        dx={props.width as number}
        dy={props.height as number}
        payload={props.payload as SankeyNodePayload}
      />
    );
  }, []);

  const renderLink = useCallback((props: Record<string, unknown>) => {
    return <CustomLink {...(props as unknown as SankeyLinkPayload)} />;
  }, []);

  if (!sankeyData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cash Flow</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[400px] items-center justify-center">
          <p className="text-muted-foreground">No income data for this period</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash Flow</CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="h-[400px] w-full">
          {containerWidth > 0 && (
            <Sankey
              width={containerWidth}
              height={400}
              data={sankeyData}
              nodeWidth={15}
              nodePadding={24}
              linkCurvature={0.5}
              iterations={64}
              margin={{ top: 20, right: 160, bottom: 20, left: 160 }}
              node={renderNode}
              link={renderLink}
            >
              <Tooltip content={<CustomTooltip />} />
            </Sankey>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
