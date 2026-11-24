// ============================================================
// STATISTICS ENGINE
// ============================================================
function calcBoxScore(events, playerId) {
  const evs = events.filter(e => e.player_id === playerId && !e.voided);
  let pts=0,fgm=0,fga=0,pm2=0,pa2=0,pm3=0,pa3=0,ftm=0,fta=0,orb=0,drb=0,ast=0,stl=0,blk=0,tov=0,pf=0;
  for (const e of evs) {
    switch(e.type) {
      case '2PM': pts+=2; fgm++; fga++; pm2++; pa2++; break;
      case '2PA': fga++; pa2++; break;
      case '3PM': pts+=3; fgm++; fga++; pm3++; pa3++; break;
      case '3PA': fga++; pa3++; break;
      case 'FTM': pts++; ftm++; fta++; break;
      case 'FTA': fta++; break;
      case 'ORB': orb++; break;
      case 'DRB': drb++; break;
      case 'AST': ast++; break;
      case 'STL': stl++; break;
      case 'BLK': blk++; break;
      case 'TOV': tov++; break;
      case 'PF': pf++; break;
    }
  }
  const trb = orb + drb;
  const fgPct = fga > 0 ? (fgm/fga*100).toFixed(1) : 'N/A';
  const p2Pct = pa2 > 0 ? (pm2/pa2*100).toFixed(1) : 'N/A';
  const p3Pct = pa3 > 0 ? (pm3/pa3*100).toFixed(1) : 'N/A';
  const ftPct = fta > 0 ? (ftm/fta*100).toFixed(1) : 'N/A';
  return { pts, fgm, fga, fgPct, pm2, pa2, p2Pct, pm3, pa3, p3Pct, ftm, fta, ftPct, orb, drb, trb, ast, stl, blk, tov, pf };
}
function calcTeamBoxScore(events, teamSide='home') {
  const evs = events.filter(e => e.team === teamSide && !e.voided);
  let pts=0,fgm=0,fga=0,pm2=0,pa2=0,pm3=0,pa3=0,ftm=0,fta=0,orb=0,drb=0,ast=0,stl=0,blk=0,tov=0,pf=0;
  for (const e of evs) {
    switch(e.type) {
      case '2PM': pts+=2; fgm++; fga++; pm2++; pa2++; break;
      case '2PA': fga++; pa2++; break;
      case '3PM': pts+=3; fgm++; fga++; pm3++; pa3++; break;
      case '3PA': fga++; pa3++; break;
      case 'FTM': pts++; ftm++; fta++; break;
      case 'FTA': fta++; break;
      case 'ORB': orb++; break;
      case 'DRB': drb++; break;
      case 'AST': ast++; break;
      case 'STL': stl++; break;
      case 'BLK': blk++; break;
      case 'TOV': tov++; break;
      case 'PF': pf++; break;
    }
  }
  const trb = orb + drb;
  return { pts, fgm, fga, pm2, pa2, pm3, pa3, ftm, fta, orb, drb, trb, ast, stl, blk, tov, pf };
}
function calcAdvanced(teamStats, oppStats, minutes = 40) {
  const { pts: tp, fgm, fga, pm3, pa3, ftm, fta, orb, drb: tdrb, ast, tov, pf } = teamStats;
  const { pts: op, drb: odrb, orb: oorb, tov: otov, fga: ofga, fta: ofta, ftm: oftm } = oppStats;
  const odrb2 = odrb || 1;
  const orbPct = orb + odrb2 > 0 ? (orb / (orb + odrb2) * 100).toFixed(1) : 'N/A';
  const tsPct = (2*fga + 0.44*fta) > 0 ? (tp / (2*(2*fga + 0.44*fta)) * 100).toFixed(1) : 'N/A';
  const efgPct = fga > 0 ? ((fgm + 0.5*pm3) / fga * 100).toFixed(1) : 'N/A';
  const astTov = tov > 0 ? (ast / tov).toFixed(2) : 'N/A';
  const ftRate = fga > 0 ? (fta / fga).toFixed(3) : 'N/A';
  const tovPct = (fga + 0.44*fta + tov) > 0 ? (tov / (fga + 0.44*fta + tov) * 100).toFixed(1) : 'N/A';
  // Estimate possessions
  const posHome = fga - orb + tov + 0.44*fta;
  const posOpp = ofga - oorb + otov + 0.44*ofta;
  const pace = minutes > 0 ? ((posHome + posOpp) / 2 / minutes * 40).toFixed(1) : 'N/A';
  const offRtg = posHome > 0 ? (tp / posHome * 100).toFixed(1) : 'N/A';
  const defRtg = posOpp > 0 ? (op / posOpp * 100).toFixed(1) : 'N/A';
  const netRtg = (offRtg !== 'N/A' && defRtg !== 'N/A') ? (parseFloat(offRtg) - parseFloat(defRtg)).toFixed(1) : 'N/A';
  return { orbPct, tsPct, efgPct, astTov, ftRate, tovPct, pace, offRtg, defRtg, netRtg };
}

function fmtPct(v) { return v === 'N/A' ? 'N/A' : v + '%'; }
function fmtStat(v) { return v == null ? '—' : v; }
