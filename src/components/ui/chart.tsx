import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "src/lib/utils"

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode
    icon?: React.ComponentType
    color?: string
    theme?: Record<string, string>
  }
>

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }
  return context
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"]
  }
>(({ id, className, config, children, ...props }, ref) => {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        ref={ref}
        data-chart={chartId}
        style={
          {
            "--color-chart-1": "var(--chart-1)",
            "--color-chart-2": "var(--chart-2)",
            "--color-chart-3": "var(--chart-3)",
            "--color-chart-4": "var(--chart-4)",
            "--color-chart-5": "var(--chart-5)",
          } as React.CSSProperties
        }
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-grid-horizontal_line]:stroke-border [&_.recharts-cartesian-grid-vertical_line]:stroke-border [&_.recharts-legend-item_svg]:mr-1 [&_.recharts-legend-item_svg]:h-3 [&_.recharts-legend-item_svg]:w-3 [&_.recharts-legend-item_svg]:text-muted-foreground [&_.recharts-legend-item]:inline-flex [&_.recharts-legend-item]:items-center [&_.recharts-legend-item]:font-semibold [&_.recharts-legend-item]:text-muted-foreground [&_.recharts-legend-item]:hover:text-foreground [&_.recharts-legend-item]:cursor-pointer [&_.recharts-plot-background]:fill-muted/30 [&_.recharts-polar-grid-concentric-path]:stroke-border [&_.recharts-polar-grid-angle-line]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-sector]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none [&_.recharts-surface]:overflow-visible [&_.recharts-tooltip-cursor]:fill-muted/30 [&_.recharts-yAxis_line]:stroke-transparent [&_.recharts-xAxis_line]:stroke-transparent [&_.recharts-xAxis_tick_line]:stroke-transparent [&_.recharts-yAxis_tick_line]:stroke-transparent",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer width="100%" height="100%">
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = "ChartContainer"

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([_, config]) => config.color || config.theme
  )

  if (!colorConfig.length) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(config)
          .map(([key, value]) => {
            const color = value.color
            if (!color) return ""
            return `
              [data-chart="${id}"] {
                --color-${key}: ${color};
              }
              .${key} {
                fill: var(--color-${key});
                stroke: var(--color-${key});
              }
            `
          })
          .join("\n"),
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

interface ChartTooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  active?: boolean
  payload?: any[]
  label?: any
  labelFormatter?: (label: any, payload: any[]) => React.ReactNode
  labelClassName?: string
  formatter?: any
  hideLabel?: boolean
  hideIndicator?: boolean
  indicator?: "line" | "dot" | "dashed"
  nameKey?: string
  labelKey?: string
}

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  ChartTooltipContentProps
>(
  (
    {
      className,
      active,
      payload,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      hideLabel = false,
      hideIndicator = false,
      indicator = "dot",
      nameKey,
      labelKey,
      ...props
    },
    ref
  ) => {
    const { config } = useChart()

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !active || !payload?.length) {
        return null
      }

      const value =
        typeof label === "string"
          ? config[label]?.label || label
          : labelFormatter
          ? labelFormatter(label, payload)
          : label

      return (
        <div className={cn("font-medium", labelClassName)}>{value}</div>
      )
    }, [
      label,
      labelFormatter,
      payload,
      active,
      hideLabel,
      labelClassName,
      config,
      labelKey,
    ])

    if (!active || !payload?.length) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-[8rem] items-start gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-md",
          className
        )}
        {...props}
      >
        {tooltipLabel}
        <div className="grid gap-1.5">
          {payload.map((item: any, index: number) => {
            const key = `${nameKey || item.name || item.dataKey || "value"}`
            const itemConfig = config[key]
            const indicatorColor = item.color || item.payload?.fill || "var(--border)"

            return (
              <div
                key={item.dataKey || index}
                className={cn(
                  "flex w-full items-center gap-2 [&_svg]:h-2.5 [&_svg]:w-2.5 [&_svg]:text-muted-foreground",
                  indicator === "dashed" && "border-t border-dashed"
                )}
              >
                {itemConfig?.icon ? (
                  <itemConfig.icon />
                ) : (
                  !hideIndicator && (
                    <div
                      className={cn(
                        "shrink-0 rounded-[2px] border-[var(--color-border)] bg-[var(--color-bg)]",
                        {
                          "h-2.5 w-2.5": indicator === "dot",
                          "w-1 border-t-2": indicator === "line",
                          "h-2.5 w-1 border-l-2 border-dashed bg-transparent":
                            indicator === "dashed",
                        }
                      )}
                      style={
                        {
                          "--color-bg": indicatorColor,
                          "--color-border": indicatorColor,
                        } as React.CSSProperties
                      }
                    />
                  )
                )}
                <div className="flex flex-1 justify-between leading-none">
                  <div className="grid gap-0.5">
                    <span className="text-muted-foreground">
                      {itemConfig?.label || item.name}
                    </span>
                  </div>
                  {item.value !== undefined && (
                    <span className="font-bold text-foreground">
                      {typeof formatter === "function"
                        ? formatter(item.value, item.name, item, index, payload)
                        : item.value}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)
ChartTooltipContent.displayName = "ChartTooltipContent"

const ChartLegend = RechartsPrimitive.Legend

interface ChartLegendContentProps extends React.HTMLAttributes<HTMLDivElement> {
  payload?: any[]
  verticalAlign?: "top" | "bottom" | "middle"
  nameKey?: string
}

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  ChartLegendContentProps
>(({ className, payload, verticalAlign = "bottom", nameKey }, ref) => {
  const { config } = useChart()

  if (!payload?.length) {
    return null
  }

  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-center gap-4",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className
      )}
    >
      {payload.map((item: any) => {
        const key = `${nameKey || item.dataKey || "value"}`
        const itemConfig = config[key]

        return (
          <div
            key={item.value}
            className={cn(
              "flex items-center gap-1.5 [&_svg]:h-3 [&_svg]:w-3 [&_svg]:text-muted-foreground text-xs font-semibold text-muted-foreground hover:text-foreground"
            )}
          >
            {itemConfig?.icon ? (
              <itemConfig.icon />
            ) : (
              <div
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{
                  backgroundColor: item.color,
                }}
              />
            )}
            {itemConfig?.label || item.value}
          </div>
        )
      })}
    </div>
  )
})
ChartLegendContent.displayName = "ChartLegendContent"

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
}
