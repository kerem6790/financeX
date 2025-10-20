import { useMemo, useState } from 'react';
import Dashboard from './Dashboard';
import EkGelir from './EkGelir';
import Expenses from './Expenses';
import InputPanel from './InputPanel';
import Planning from './Planning';
import './App.css';

type TabKey = 'inputs' | 'dashboard' | 'expenses' | 'planning' | 'extra-income';

interface TabConfig {
  key: TabKey;
  label: string;
  heading: string;
  subtitle?: string;
  render?: () => JSX.Element;
}

const tabs: TabConfig[] = [
  {
    key: 'inputs',
    label: 'Girdiler',
    heading: 'Girdiler',
    subtitle: 'Finansal kalemlerinizi burada yönetin.'
  },
  {
    key: 'dashboard',
    label: 'Dashboard',
    heading: 'Dashboard',
    subtitle: 'Finansal özet ve trendler burada.'
  },
  {
    key: 'expenses',
    label: 'Harcamalar',
    heading: 'Harcamalar',
    subtitle: 'Güncel harcamalarınızın kaydı.'
  },
  {
    key: 'planning',
    label: 'Planlama',
    heading: 'Planlama',
    subtitle: 'Bütçe hedefleri ve projeksiyonları yönetin.'
  },
  {
    key: 'extra-income',
    label: 'Ek Gelir',
    heading: 'Ek Gelir',
    subtitle: 'Teorik gelir projeksiyonlarını inceleyin.',
    render: () => <EkGelir />
  }
];

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('inputs');
  const activeContent = useMemo(() => tabs.find((tab) => tab.key === activeTab) ?? tabs[0], [activeTab]);
  const subtitle = activeContent.subtitle ?? 'finance yönetimi masaüstü deneyimi';
  const isInputs = activeContent.key === 'inputs';
  const isPlanning = activeContent.key === 'planning';
  const isDashboard = activeContent.key === 'dashboard';
  const isExpenses = activeContent.key === 'expenses';
  const isExtraIncome = activeContent.key === 'extra-income';
  const bodyClassName = isInputs || isPlanning || isDashboard || isExpenses || isExtraIncome
    ? 'workspace__body workspace__body--inputs'
    : 'workspace__body';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__mark">FX</span>
          <span className="brand__name">financeX</span>
        </div>
        <nav className="nav">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`nav__item${tab.key === activeTab ? ' nav__item--active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="workspace">
        <header className="workspace__header">
          <h1 className="workspace__title">{activeContent.heading}</h1>
          <span className="workspace__meta">{subtitle}</span>
        </header>
        <section className={bodyClassName}>
          {isInputs ? (
            <InputPanel />
          ) : isPlanning ? (
            <Planning />
          ) : isDashboard ? (
            <Dashboard />
          ) : isExpenses ? (
            <Expenses />
          ) : activeContent.render ? (
            activeContent.render()
          ) : null}
        </section>
      </main>
    </div>
  );
}

export default App;
