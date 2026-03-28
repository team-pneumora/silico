import Link from 'next/link'
import { Company } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface CompanyListProps {
  companies: Company[]
}

function formatUSD(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export async function CompanyList({ companies }: CompanyListProps) {
  const statusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'paused':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      default:
        return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
    }
  }

  if (companies.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/dashboard/new">
          <Card className="bg-[#111] border-zinc-800 border-dashed hover:border-zinc-600 transition-colors cursor-pointer h-full">
            <CardContent className="p-6 flex flex-col items-center justify-center min-h-[180px]">
              <span className="text-4xl text-zinc-600 mb-2">+</span>
              <p className="text-sm text-zinc-500">New Company</p>
            </CardContent>
          </Card>
        </Link>
        <div className="col-span-full text-center py-12">
          <p className="text-zinc-500 text-sm">No companies yet. Create your first one to get started.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {companies.map((company) => (
        <Link key={company.id} href={`/dashboard/${company.id}`}>
          <Card className="bg-[#111] border-zinc-800 hover:border-zinc-600 transition-colors cursor-pointer h-full">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl">{company.emoji}</span>
                <Badge variant="outline" className={statusColor(company.status)}>
                  {company.status}
                </Badge>
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">{company.name}</h3>
              <div className="flex items-center gap-3 text-xs text-zinc-500 mt-3">
                <span>Round {company.current_round}</span>
                <span className="text-zinc-700">|</span>
                <span className="text-zinc-300 font-medium">
                  {formatUSD(company.treasury_usd ?? 0)}
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}

      <Link href="/dashboard/new">
        <Card className="bg-[#111] border-zinc-800 border-dashed hover:border-zinc-600 transition-colors cursor-pointer h-full">
          <CardContent className="p-6 flex flex-col items-center justify-center min-h-[180px]">
            <span className="text-4xl text-zinc-600 mb-2">+</span>
            <p className="text-sm text-zinc-500">New Company</p>
          </CardContent>
        </Card>
      </Link>
    </div>
  )
}
