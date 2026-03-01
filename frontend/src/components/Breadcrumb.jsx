export default function Breadcrumb({ crumbs, onNavigate }) {
  return (
    <nav className="flex items-center gap-1 text-xs text-slate-500 flex-wrap">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1">
          <button
            onClick={() => onNavigate(crumb.action)}
            className="hover:text-slate-300 transition-colors"
          >
            {crumb.label}
          </button>
          <span className="text-slate-700">›</span>
        </span>
      ))}
    </nav>
  )
}
