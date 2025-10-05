import { useMemo, useState } from 'react';
import Dashboard from './Dashboard';
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
  placeholder?: string;
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
    subtitle: 'Yakında aktif olacak.',
    placeholder: 'Dashboard – Çok yakında.'
  },
  {
    key: 'expenses',
    label: 'Harcamalar',
    heading: 'Harcamalar',
    subtitle: 'Yakında harcama analizi burada olacak.',
    placeholder: 'Harcamalar – Çok yakında.'
  },
  {
    key: 'planning',
    label: 'Planlama',
    heading: 'Planlama',
    subtitle: 'Bütçe ve hedef planlama ekranı yolda.',
    placeholder: 'Planlama – Çok yakında.'
  },
  {
    key: 'extra-income',
    label: 'Ek Gelir',
    heading: 'Ek Gelir',
    subtitle: 'Hedeflenen ve gerçekleşen ek gelirler yakında.',
    placeholder: 'Ek Gelir – Çok yakında.'
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
  const bodyClassName = isInputs || isPlanning || isDashboard || isExpenses
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
          ) : (
            <div className="placeholder">
              <p>{activeContent.placeholder}</p>
              <p>Bu alan yakında ilgili sekmenin içerikleriyle güncellenecek.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
