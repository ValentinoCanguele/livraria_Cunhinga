import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, BarChart3, ShoppingBag, MessageCircle, TrendingUp, Search, Calendar, BookOpen } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { exportOrdersToExcel, exportSalesReportSummary, computeSalesReport } from '@/lib/orderExport';
import { getOrderStatusLabel } from '@/lib/orderUtils';

function filterOrders(orders, { search, channel, dateFrom, dateTo, status }) {
  return orders.filter((o) => {
    if (status && status !== 'all' && o.status !== status) return false;
    if (channel === 'online' && (o.order_type === 'whatsapp_order' || o.sale_channel === 'whatsapp')) return false;
    if (channel === 'whatsapp' && o.order_type !== 'whatsapp_order' && o.sale_channel !== 'whatsapp') return false;
    if (dateFrom) {
      const d = new Date(o.created);
      if (d < new Date(dateFrom)) return false;
    }
    if (dateTo) {
      const d = new Date(o.created);
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      if (d > end) return false;
    }
    if (search?.trim()) {
      const q = search.toLowerCase();
      const hay = [
        o.order_number, o.id, o.customer_name, o.customer_email, o.phone, o.notes,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export default function SalesReportsPanel({ orders }) {
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState('all');
  const [status, setStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filtered = useMemo(
    () => filterOrders(orders, { search, channel, dateFrom, dateTo, status }),
    [orders, search, channel, dateFrom, dateTo, status],
  );

  const report = useMemo(() => computeSalesReport(filtered), [filtered]);

  const fmt = (n) => `Kz ${Number(n).toLocaleString('pt-AO', { minimumFractionDigits: 2 })}`;

  const clearFilters = () => {
    setSearch('');
    setChannel('all');
    setStatus('all');
    setDateFrom('');
    setDateTo('');
  };

  const hasFilters = search || channel !== 'all' || status !== 'all' || dateFrom || dateTo;

  return (
    <div className="space-y-6 mb-8">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#0ea5c9]" /> Relatórios de Vendas
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Histórico completo · exportação Excel · totais por canal
            {hasFilters && <span className="text-[#0ea5c9]"> · {filtered.length} de {orders.length} pedidos</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => exportOrdersToExcel(filtered)}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Exportar Filtrado (Excel)
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportSalesReportSummary(filtered)}>
            <Download className="h-4 w-4 mr-2" /> Relatório Resumo
          </Button>
        </div>
      </div>

      <div className="bg-card border rounded-xl p-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="space-y-1.5 lg:col-span-2">
          <Label className="text-xs flex items-center gap-1"><Search className="h-3 w-3" /> Pesquisar</Label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cliente, email, nº pedido..."
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Canal</Label>
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="online">Compra Online</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Estado</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="confirmed">Confirmado</SelectItem>
              <SelectItem value="shipped">Enviado</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" /> De</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Até</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" />
        </div>
        {hasFilters && (
          <div className="sm:col-span-2 lg:col-span-5">
            <Button variant="ghost" size="sm" className="text-xs h-8" onClick={clearFilters}>Limpar filtros</Button>
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> Receita Total</p>
          <p className="text-2xl font-bold text-[#0ea5c9] mt-1">{fmt(report.totalRevenue)}</p>
          <p className="text-xs text-muted-foreground">{report.activeOrders} pedidos activos</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><ShoppingBag className="h-3.5 w-3.5" /> Compras Online</p>
          <p className="text-2xl font-bold mt-1">{report.onlineOrders}</p>
          <p className="text-xs text-[#0ea5c9]">{fmt(report.onlineRevenue)}</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> Encomendas WhatsApp</p>
          <p className="text-2xl font-bold mt-1">{report.whatsappOrders}</p>
          <p className="text-xs text-green-700">{fmt(report.whatsappRevenue)}</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Ticket Médio</p>
          <p className="text-2xl font-bold mt-1">{fmt(report.averageOrder)}</p>
          <p className="text-xs text-muted-foreground">{report.cancelledOrders} cancelados</p>
        </div>
      </div>

      {report.byDay?.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-card border rounded-xl p-4">
            <h4 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#0ea5c9]" /> Vendas diárias (14 dias)
            </h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.byDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => [`Kz ${Number(v).toLocaleString('pt-AO')}`, 'Receita']} labelFormatter={(l) => l} />
                  <Bar dataKey="revenue" fill="#0ea5c9" radius={[4, 4, 0, 0]} name="Receita" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card border rounded-xl p-4">
            <h4 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[#0ea5c9]" /> Livros mais vendidos
            </h4>
            {report.topBooks?.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.topBooks} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="title" width={100} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => [v, 'Unidades']} />
                    <Bar dataKey="quantity" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Unidades" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-16">Sem dados de livros no período filtrado.</p>
            )}
          </div>
        </div>
      )}

      {Object.keys(report.byMonth).length > 0 && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="p-4 border-b font-semibold text-sm">Vendas por mês</div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-3">Mês</th>
                <th className="p-3">Pedidos</th>
                <th className="p-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {Object.entries(report.byMonth).map(([month, data]) => (
                <tr key={month}>
                  <td className="p-3 capitalize">{month}</td>
                  <td className="p-3">{data.count}</td>
                  <td className="p-3 text-right font-medium text-[#0ea5c9]">{fmt(data.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="p-4 border-b font-semibold text-sm">Por estado</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border">
          {Object.entries(report.byStatus).map(([st, data]) => (
            <div key={st} className="bg-card p-4">
              <p className="text-xs text-muted-foreground">{getOrderStatusLabel(st)}</p>
              <p className="font-bold">{data.count} pedidos</p>
              <p className="text-sm text-[#0ea5c9]">{fmt(data.total)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
