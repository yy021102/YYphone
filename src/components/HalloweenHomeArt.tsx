export function HalloweenThemePreview() {
  return <div className="hw-theme-preview" aria-hidden="true"><strong>南瓜夜宴</strong><span>✦</span><div>{[0,1,2,3].map(i=><em key={i}/>)}</div></div>;
}
