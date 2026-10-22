import { DashboardCard, DashboardGrid } from '../../../../components/DashboardCard'

// Reserves the Dashboard's height while the data or the chart chunk loads, so the content below does not jump.
// `cards` lists the card testIds with their widths, in DOM order.
export function DashboardSkeleton({ cards, label }: { cards: { testId: string; title: string; subtitle?: string; fullWidth?: boolean; wide?: boolean }[]; label: string }) {
  return (
    <div aria-busy="true" aria-label={label} data-testid="dashboard-loading">
      <DashboardGrid>
        {cards.map((card) => (
          <DashboardCard key={card.testId} testId={card.testId} title={card.title} subtitle={card.subtitle} fullWidth={card.fullWidth} wide={card.wide} loading />
        ))}
      </DashboardGrid>
    </div>
  )
}
