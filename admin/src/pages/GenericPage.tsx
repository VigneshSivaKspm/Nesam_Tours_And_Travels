interface GenericPageProps {
  title: string;
  description: string;
  icon: string;
}

export default function GenericPage({ title, description, icon }: GenericPageProps) {
  return (
    <div className="p-6">
      <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-16 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#FEF2F2" }}>
          <svg className="w-8 h-8" style={{ color: "#E21B23" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            {icon.split(" M").map((d, i) => (
              <path key={i} strokeLinecap="round" strokeLinejoin="round" d={i === 0 ? d : "M" + d} />
            ))}
          </svg>
        </div>
        <h2 className="text-[18px] font-bold text-[#111] mb-2">{title}</h2>
        <p className="text-[13px] text-[#999] max-w-xs">{description}</p>
        <button className="mt-6 px-6 py-2.5 text-[13px] font-semibold text-white rounded-lg hover:opacity-90 transition-opacity" style={{ background: "#E21B23" }}>
          Get Started
        </button>
      </div>
    </div>
  );
}
