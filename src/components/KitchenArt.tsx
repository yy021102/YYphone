import { useId } from 'react';
import { kitchenIngredient, kitchenType, type KitchenIngredient, type KitchenRecipe } from '../utils/kitchen';

function IngredientShape({ ingredient, x = 0, y = 0, size = 1, rotation = 0 }: { ingredient: KitchenIngredient; x?: number; y?: number; size?: number; rotation?: number }) {
  const { color, shape, id } = ingredient;
  return <g transform={`translate(${x} ${y}) rotate(${rotation}) scale(${size})`} fill={color} stroke="#fff9" strokeWidth="1">
    {id === 'heart' ? <><path d="M0 2v17" stroke="#b89987" strokeWidth="2"/><path d="M0 5C-21-5-9-22 0-12 9-22 21-5 0 5Z"/></> :
      id === 'egg' ? <><ellipse rx="15" ry="11" fill="#fff5df"/><circle r="7" stroke="none"/></> :
      ['pork', 'pork-belly', 'bacon'].includes(id) ? <><path d="M-15-6q10-6 28-1l-2 14q-15-4-27 1Z"/><path d="m-12-2 23 1m-24 5 23 1" stroke="#f4d8c4" strokeWidth={id === 'pork' ? 1.5 : 3}/></> :
      id === 'shrimp' ? <><path d="M10-9C-12-23-23 13-1 16l7-7C-7 12-10-6 4-2l6-7Z"/><path d="m-8-7 6 3m-10 4 7 1m-5 5 6-2" stroke="#fff0db" strokeWidth="2"/></> :
      id === 'mushroom' ? <><path d="M-3-1h6l3 14h-12Z" fill="#e7d8bd"/><path d="M-16 0q1-23 16-23T16 0q-16 9-32 0Z"/></> :
      id === 'broccoli' ? <><path d="M-3 0h6l4 15h-14Z" fill="#b9c79b"/><circle cx="-8" cy="-4" r="9"/><circle cy="-10" r="10"/><circle cx="9" cy="-3" r="9"/></> :
      ['blueberry', 'grape', 'cherry'].includes(id) ? <><circle r="12"/><path d="m-4-4 4 2 4-2-2 4 2 3-4-1-3 1 1-4Z" fill="#ffffff70" stroke="none"/>{id === 'cherry' && <path d="M1-11q2-9 10-10" fill="none" stroke="#9eaa83" strokeWidth="2"/>}</> :
      id === 'lotus-root' ? <><ellipse rx="15" ry="11"/>{[[0, 0], [-8, -3], [7, -3], [-5, 5], [6, 5]].map(([cx, cy], index) => <ellipse key={index} cx={cx} cy={cy} rx="2.5" ry="2" fill="#bbab96" stroke="none"/>)}</> :
      shape === 'leaf' ? <><path d="M-12 9Q-19-15 12-10 18 15-12 9Z"/><path d="m-9 7 15-13" stroke="#f3f2d5" strokeWidth="1.5"/></> :
      shape === 'berry' ? <><path d="M-12-5Q-11-17 0-11 11-17 12-5 11 8 0 15-11 8-12-5Z"/><path d="m-8-10 8 4 8-4-7-3Z" fill="#92a27b" stroke="none"/><path d="M-4-2v2m8-1v2m-5 5v2" stroke="#f5d9bb" strokeWidth="1.5"/></> :
      shape === 'grain' ? <><ellipse cx="-5" rx="4" ry="8" transform="rotate(-25)"/><ellipse cx="7" cy="3" rx="4" ry="7" transform="rotate(25)"/></> :
      shape === 'slice' ? <><path d="M-14 1a14 14 0 0 1 28 0L8 10H-8Z"/><path d="M-8 1h16" stroke="#ffffffa0" strokeWidth="2"/></> :
      shape === 'cream' ? <path d="M-13 8Q-15 2-8-2-12-7-3-9L1-17Q2-9 8-6 15-3 10 1 19 10 6 12H-6Q-15 12-13 8Z"/> :
      shape === 'sprinkle' ? <g stroke={color} strokeWidth="3" strokeLinecap="round"><path d="m-10-7 4 3m9-7 2 5m5 7-5 2m-9 0-2 4m9 1 3 3"/></g> :
      <rect x="-10" y="-8" width="20" height="17" rx="5" transform="rotate(-12)"/>}
  </g>;
}
export function KitchenIngredientArt({ ingredient }: { ingredient: KitchenIngredient }) {
  return <svg viewBox="-22 -22 44 44" aria-hidden="true"><IngredientShape ingredient={ingredient}/></svg>;
}
interface FoodPiece { id: string; index: number; x: number; y: number; size: number; rotation: number }
export function kitchenFoodPieces(recipe: KitchenRecipe): FoodPiece[] {
  const dessert = kitchenType(recipe.typeId).category === 'dessert';
  const hidden = ['rice', 'noodles', 'broth', 'flour', 'milk', 'butter', 'salt', 'sugar', 'soy', 'pepper', 'honey', 'cocoa', 'matcha',
    'coconut-milk', 'condensed-milk', 'vinegar', 'oyster-sauce', 'curry', 'tomato-sauce', 'maple', 'vanilla', 'cinnamon'];
  const pieces = recipe.parts.filter(p => !hidden.includes(p.id) && !(dessert && p.id === 'egg')).flatMap(part => {
    const ingredient = kitchenIngredient(part.id);
    const seed = Array.from(part.id).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0);
    const fine = ingredient.shape === 'grain' || ingredient.shape === 'sprinkle';
    const count = part.id === 'heart' ? part.amount : (dessert ? (fine ? 5 : 2) : (fine ? 8 : 5)) * part.amount;
    return Array.from({ length: count }, (_, index): FoodPiece => {
      // Stable, ingredient-specific golden-angle scatter keeps additions from moving existing food.
      const angle = seed % 360 * Math.PI / 180 + index * 2.399963229728653;
      const radius = Math.sqrt(((seed % 97 + index * 37) % 101 + .5) / 101);
      let cx = 160, cy = dessert ? 107 : 144, rx = dessert ? 59 : 77, ry = dessert ? 22 : 32;
      if (recipe.typeId === 'pudding') { rx = 30; ry = 10; cy = 100; }
      if (recipe.typeId === 'cookie') {
        const centers = [[119, 130], [196, 132], [156, 169]];
        [cx, cy] = centers[(index + seed) % centers.length]; rx = 24; ry = 14;
      }
      if (recipe.typeId === 'icecream') {
        const centers = [[132, 130], [188, 130], [160, 96]];
        [cx, cy] = centers[(index + seed) % centers.length]; rx = 22; ry = 17;
      }
      return { id: part.id, index, x: cx + Math.cos(angle) * radius * rx, y: cy + Math.sin(angle) * radius * ry,
        size: part.id === 'heart' ? .8 : (dessert ? .48 : .58) * (.8 + ((seed + index * 13) % 23) / 50),
        rotation: (seed + index * 47) % 100 - 50 };
    });
  });
  return pieces.sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id) || a.index - b.index);
}
export function KitchenArt({ recipe, compact = false }: { recipe: KitchenRecipe; compact?: boolean }) {
  const clip = `kitchen-${useId().replace(/:/g, '')}`;
  const type = kitchenType(recipe.typeId), dessert = type.category === 'dessert';
  const palette = { porcelain: ['#f9f1e2', '#ded0b9'], sage: ['#dfe7d7', '#b6c6ab'], rose: ['#f1dee1', '#d4b8c2'], bear: ['#ecddc6', '#ceb796'] }[recipe.plate];
  const cocoa = recipe.parts.some(p => p.id === 'cocoa'), matcha = recipe.parts.some(p => p.id === 'matcha');
  const pastry = cocoa ? '#b29380' : matcha ? '#b4c092' : '#ead5ae';
  const cream = recipe.parts.some(p => p.id === 'cream');
  const fruit = recipe.parts.map(p => kitchenIngredient(p.id)).find(i => i.group === 'fruit');
  const caramel = recipe.parts.some(p => p.id === 'sugar' || p.id === 'honey');
  const pieces = kitchenFoodPieces(recipe);
  const riceAmount = recipe.parts.find(p => p.id === 'rice')?.amount ?? 0;
  const noodleAmount = recipe.parts.find(p => p.id === 'noodles')?.amount ?? 0;
  return <div className={`kitchen-art${compact ? ' is-compact' : ''}`}>
    {recipe.cover ? <img src={recipe.cover} alt={`${recipe.name || type.name}的成品封面`}/> :
      <svg viewBox="0 0 320 260" role="img" aria-label={`${recipe.name || type.name}的料理插画`}>
        <defs><clipPath id={clip}><ellipse cx="160" cy={dessert ? 116 : 144} rx={dessert ? 78 : 92} ry={dessert ? 40 : 47}/></clipPath></defs>
        <ellipse cx="160" cy="222" rx="107" ry="11" fill="#ae917a" opacity=".1"/>
        {recipe.plate === 'bear' && <g fill={palette[0]} stroke={palette[1]} strokeWidth="2"><circle cx="64" cy="133" r="26"/><circle cx="256" cy="133" r="26"/><circle cx="64" cy="133" r="13" fill={palette[1]} opacity=".4"/><circle cx="256" cy="133" r="13" fill={palette[1]} opacity=".4"/></g>}
        <ellipse cx="160" cy="177" rx="119" ry="47" fill={palette[1]} opacity=".5"/>
        <ellipse cx="160" cy="169" rx="120" ry="48" fill={palette[0]} stroke="#fffaf4" strokeWidth="3"/>
        <ellipse cx="160" cy="167" rx="100" ry="35" fill="none" stroke={palette[1]} strokeWidth="1.5" strokeDasharray="2 5"/>
        {!dessert && (recipe.typeId === 'soup' || recipe.typeId === 'noodles') ? <>
          <path d="M58 139q9 77 102 77t102-77Z" fill={palette[1]} stroke={palette[0]} strokeWidth="3"/>
          <ellipse cx="160" cy="139" rx="102" ry="51" fill={palette[0]} stroke="#fffaf4" strokeWidth="3"/>
          <ellipse cx="160" cy="141" rx="91" ry="42" fill={recipe.typeId === 'soup' ? '#e5cc98' : '#e8d3aa'}/>
        </> : !dessert && <ellipse cx="160" cy="145" rx="92" ry="48" fill={recipe.typeId === 'rice' ? '#eee1c2' : '#dfc7a6'}/>}
        {recipe.typeId === 'rice' && <g data-kitchen-base="rice" clipPath={`url(#${clip})`} stroke="#fff6e2" strokeWidth="2" strokeLinecap="round">{Array.from({ length: riceAmount * 24 }, (_, i) =>
          <path key={i} d={`m${79 + (i * 29 % 160)} ${112 + (i * 13 % 65)} 4 -2`}/>)}</g>}
        {recipe.typeId === 'noodles' && <g data-kitchen-base="noodles" clipPath={`url(#${clip})`} fill="none" stroke="#f6e5ad" strokeWidth="4" strokeLinecap="round">{Array.from({ length: noodleAmount * 5 }, (_, i) =>
          <path key={i} d={`M${96 + (i * 43 % 135)} ${121 + (i * 7 % 14)}q-30 20 0 25t0 19`}/>)}</g>}
        {recipe.typeId === 'cake' && <>
          <path d="M86 106v61q73 47 148 0v-61Z" fill={pastry} stroke="#fff4e0" strokeWidth="2"/>
          <path d="M87 135q73 40 146 0v11q-73 40-146 0Z" fill={fruit?.color ?? (cream ? '#fff0db' : pastry)}/>
          <ellipse cx="160" cy="107" rx="74" ry="33" fill={cream ? '#fff0db' : pastry} stroke="#fff9ef" strokeWidth="2"/>
          {cream && <path d="M86 108q9 8 13 27 9 10 15-11 8-5 15 11 8 15 15-1 9-12 16 6 9 11 16-8 7-10 15 3 11 12 16-12 13-1 27-15" fill="#fff0db"/>}
        </>}
        {recipe.typeId === 'pudding' && <>
          <path d="M116 101q44-16 88 0l24 72q-67 38-136 0Z" fill={pastry} stroke="#fff0cf" strokeWidth="2"/>
          <ellipse cx="160" cy="101" rx="44" ry="17" fill={caramel ? '#c69d75' : pastry}/>{caramel && <path d="M116 103q44 19 88 0l4 15q-48 21-96 0Z" fill="#d2aa7e"/>}
        </>}
        {recipe.typeId === 'cookie' && <g fill={pastry} stroke="#d4b98e" strokeWidth="2">{[[119, 130], [196, 132], [156, 169]].map(([x, y]) =>
          <g key={x}><ellipse cx={x} cy={y + 5} rx="37" ry="27" fill="#ccb28e"/><ellipse cx={x} cy={y} rx="37" ry="27"/>{[[-14, -5], [10, 4], [0, -12], [-4, 12]].map(([dx, dy], i) => <circle key={i} cx={x + dx} cy={y + dy} r="3" fill="#a88a70" stroke="none"/>)}</g>)}</g>}
        {recipe.typeId === 'icecream' && <>
          <path d="M88 156q8 58 72 58t72-58Z" fill={palette[1]} stroke={palette[0]} strokeWidth="3"/>
          <ellipse cx="160" cy="156" rx="72" ry="27" fill={palette[0]}/>
          <circle cx="132" cy="137" r="36" fill={pastry}/><circle cx="188" cy="137" r="35" fill={fruit?.color ?? pastry}/><circle cx="160" cy="103" r="37" fill={cocoa || matcha ? pastry : '#f3e5cd'}/>
          <path d="M132 80q-19 8-15 22m47-28q-16 3-17 14m52 34q-14 3-17 13" fill="none" stroke="#fff6e0" strokeWidth="3" strokeLinecap="round"/>
        </>}
        <g clipPath={dessert ? undefined : `url(#${clip})`}>{pieces.map(piece =>
          <g key={`${piece.id}-${piece.index}`} className="kitchen-food-bit" data-ingredient={piece.id}>
            <IngredientShape ingredient={kitchenIngredient(piece.id)} x={piece.x} y={piece.y} size={piece.size} rotation={piece.rotation}/>
          </g>)}</g>
        {!dessert && <g className="kitchen-steam" fill="none" stroke="#c6b7a3" strokeWidth="2" strokeLinecap="round" opacity=".5"><path d="M135 76q-10-12 0-24t0-21m28 40q10-12 0-23t0-17m27 48q10-12 0-24t0-19"/></g>}
        <g fill="#c4a280" opacity=".6"><path d="m55 77 3-7 3 7 7 3-7 3-3 7-3-7-7-3Zm207 18 2-5 2 5 5 2-5 2-2 5-2-5-5-2Z"/><circle cx="83" cy="57" r="2"/><circle cx="240" cy="61" r="2"/></g>
      </svg>}
  </div>;
}
