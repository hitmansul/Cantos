/**
 * Times/seleções da Copa do Mundo.
 * Regra: quando a pergunta/tela for Copa do Mundo, usar somente dados desta competição.
 */

export type WorldCupTeam = {
  team: string;
  fifaName?: string;
  aliases: string[];
  group?: string;
};

export function normalizeWorldCupText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u00ba\u00b0]/g, 'o')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const worldCupTeams: WorldCupTeam[] = [
  { team: 'Brasil', fifaName: 'Brazil', aliases: ['brasil', 'brazil', 'seleção brasileira', 'selecao brasileira'] },
  { team: 'Argentina', fifaName: 'Argentina', aliases: ['argentina'] },
  { team: 'França', fifaName: 'France', aliases: ['franca', 'frança', 'france'] },
  { team: 'Inglaterra', fifaName: 'England', aliases: ['inglaterra', 'england'] },
  { team: 'Espanha', fifaName: 'Spain', aliases: ['espanha', 'spain'] },
  { team: 'Portugal', fifaName: 'Portugal', aliases: ['portugal'] },
  { team: 'Alemanha', fifaName: 'Germany', aliases: ['alemanha', 'germany'] },
  { team: 'México', fifaName: 'Mexico', aliases: ['mexico', 'méxico'] },
  { team: 'Estados Unidos', fifaName: 'USA', aliases: ['eua', 'usa', 'estados unidos', 'united states'] },
  { team: 'Canadá', fifaName: 'Canada', aliases: ['canada', 'canadá'] },
  { team: 'Marrocos', fifaName: 'Morocco', aliases: ['marrocos', 'morocco', 'marocco'] },
  { team: 'África do Sul', fifaName: 'South Africa', aliases: ['africa do sul', 'áfrica do sul', 'south africa'] },
  { team: 'Coreia do Sul', fifaName: 'South Korea', aliases: ['coreia do sul', 'south korea', 'korea republic'] },
  { team: 'República Tcheca', fifaName: 'Czech Republic', aliases: ['republica tcheca', 'república tcheca', 'czech republic', 'czechia'] },
  { team: 'Bósnia e Herzegovina', fifaName: 'Bosnia & Herzegovina', aliases: ['bosnia', 'bósnia', 'bosnia e herzegovina', 'bosnia & herzegovina'] },
  { team: 'Paraguai', fifaName: 'Paraguay', aliases: ['paraguai', 'paraguay'] },
  { team: 'Catar', fifaName: 'Qatar', aliases: ['catar', 'qatar'] },
  { team: 'Suíça', fifaName: 'Switzerland', aliases: ['suica', 'suíça', 'switzerland'] },
  { team: 'Haiti', fifaName: 'Haiti', aliases: ['haiti'] },
  { team: 'Escócia', fifaName: 'Scotland', aliases: ['escocia', 'escócia', 'scotland'] },
  { team: 'Austrália', fifaName: 'Australia', aliases: ['australia', 'austrália'] },
  { team: 'Turquia', fifaName: 'Türkiye', aliases: ['turquia', 'turkiye', 'türkiye', 'turkey'] },
  { team: 'Curaçao', fifaName: 'Curaçao', aliases: ['curacao', 'curaçao'] },
  { team: 'Holanda', fifaName: 'Netherlands', aliases: ['holanda', 'paises baixos', 'países baixos', 'netherlands'] },
  { team: 'Japão', fifaName: 'Japan', aliases: ['japao', 'japão', 'japan'] },
  { team: 'Costa do Marfim', fifaName: 'Ivory Coast', aliases: ['costa do marfim', 'ivory coast', 'cote d ivoire'] },
  { team: 'Equador', fifaName: 'Ecuador', aliases: ['equador', 'ecuador'] },
  { team: 'Suécia', fifaName: 'Sweden', aliases: ['suecia', 'suécia', 'sweden'] },
  { team: 'Tunísia', fifaName: 'Tunisia', aliases: ['tunisia', 'tunísia'] },
  { team: 'Cabo Verde', fifaName: 'Cape Verde Islands', aliases: ['cabo verde', 'cape verde', 'cape verde islands'] },
  { team: 'Bélgica', fifaName: 'Belgium', aliases: ['belgica', 'bélgica', 'belgium'] },
  { team: 'Egito', fifaName: 'Egypt', aliases: ['egito', 'egypt'] },
  { team: 'Arábia Saudita', fifaName: 'Saudi Arabia', aliases: ['arabia saudita', 'arábia saudita', 'saudi arabia'] },
  { team: 'Uruguai', fifaName: 'Uruguay', aliases: ['uruguai', 'uruguay'] },
  { team: 'Irã', fifaName: 'Iran', aliases: ['ira', 'irã', 'iran'] },
  { team: 'Nova Zelândia', fifaName: 'New Zealand', aliases: ['nova zelandia', 'nova zelândia', 'new zealand'] },
  { team: 'Senegal', fifaName: 'Senegal', aliases: ['senegal'] },
  { team: 'Iraque', fifaName: 'Iraq', aliases: ['iraque', 'iraq'] },
  { team: 'Noruega', fifaName: 'Norway', aliases: ['noruega', 'norway'] },
  { team: 'Argélia', fifaName: 'Algeria', aliases: ['argelia', 'argélia', 'algeria'] },
  { team: 'Áustria', fifaName: 'Austria', aliases: ['austria', 'áustria'] },
  { team: 'Jordânia', fifaName: 'Jordan', aliases: ['jordania', 'jordânia', 'jordan'] },
  { team: 'RD Congo', fifaName: 'Congo DR', aliases: ['rd congo', 'congo dr', 'republica democratica do congo'] },
  { team: 'Croácia', fifaName: 'Croatia', aliases: ['croacia', 'croácia', 'croatia'] },
  { team: 'Gana', fifaName: 'Ghana', aliases: ['gana', 'ghana'] },
  { team: 'Panamá', fifaName: 'Panama', aliases: ['panama', 'panamá'] },
  { team: 'Uzbequistão', fifaName: 'Uzbekistan', aliases: ['uzbequistao', 'uzbequistão', 'uzbekistan'] },
  { team: 'Colômbia', fifaName: 'Colombia', aliases: ['colombia', 'colômbia'] },
];

export function findWorldCupTeam(text: string): WorldCupTeam | null {
  const normalized = normalizeWorldCupText(text);
  if (!normalized) return null;
  const candidates = worldCupTeams
    .map((team) => {
      const aliases = [team.team, team.fifaName ?? '', ...team.aliases].map(normalizeWorldCupText);
      const score = aliases.reduce((best, alias) => {
        if (!alias) return best;
        if (normalized === alias) return Math.max(best, 1000 + alias.length);
        if (normalized.includes(alias)) return Math.max(best, 100 + alias.length);
        if (alias.includes(normalized) && normalized.length >= 4) return Math.max(best, 50 + normalized.length);
        return best;
      }, 0);
      return { team, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.team ?? null;
}

export function isWorldCupQuestion(text: string): boolean {
  const normalized = normalizeWorldCupText(text);
  return ['copa do mundo', 'mundial', 'world cup', 'fifa world cup', 'copa fifa', 'selecoes', 'seleção', 'selecao']
    .some((term) => normalized.includes(term));
}
