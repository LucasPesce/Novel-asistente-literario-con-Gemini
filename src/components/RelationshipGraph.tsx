import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { WorldEntity, Relationship } from '../types';
import { Filter, Maximize2, Users, MapPin, Globe } from 'lucide-react';
import { cn } from '../lib/utils';

// ==========================================
// INTERFACES & TYPES
// ==========================================
interface GraphProps {
  entities: WorldEntity[];
  relationships: Relationship[];
}

interface Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: string;
  color?: string;
  imageUrl?: string;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  type: string;
}

export default function RelationshipGraph({ entities, relationships }: GraphProps) {
  // ==========================================
  // ESTADOS Y REFERENCIAS (STATES & REFS)
  // ==========================================
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedId, setSelectedId] = useState<string | 'all' | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'characters' | 'territory'>('all');

  // ==========================================
  // EFECTOS - MOTOR RENDERIZADO D3 (EFFECTS)
  // ==========================================
  useEffect(() => {
    if (!svgRef.current) return;
    
    // --- 1. CONFIGURACIÓN INICIAL DEL CANVAS ---
    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = 600;

    // Limpiar renderizados anteriores
    svg.selectAll('*').remove();

    // --- 2. PATRONES DE IMÁGENES (AVATARES DE NODOS) ---
    const defs = svg.append('defs');
    entities.forEach(entity => {
      if (entity.imageUrl) {
        defs.append('pattern')
          .attr('id', `pattern-${entity.id}`)
          .attr('patternUnits', 'objectBoundingBox')
          .attr('width', 1)
          .attr('height', 1)
          .append('image')
          .attr('xlink:href', entity.imageUrl)
          .attr('width', 80)
          .attr('height', 80)
          .attr('preserveAspectRatio', 'xMidYMid slice')
          .attr('x', -5)
          .attr('y', -5);
      }
    });

    // --- 3. ESTADO INICIAL (PANTALLA DE ESPERA) ---
    if (!selectedId) {
      const container = svg.append('g')
        .attr('transform', `translate(${width / 2}, ${height / 2})`);

      container.append('text')
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--text-muted)') // Adaptativo
        .attr('font-size', '12px')
        .attr('font-weight', 'black')
        .attr('font-family', 'JetBrains Mono')
        .attr('class', 'uppercase tracking-[0.3em]')
        .text('Mapa Estelar del Mundo');

      container.append('text')
        .attr('dy', '25')
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--text)') // Adaptativo
        .attr('font-size', '10px')
        .attr('font-family', 'Inter')
        .text('Selecciona un nodo desde el filtro para iniciar el análisis de vínculos');
      return;
    }

    // --- 4. LÓGICA DE FILTRADO DE DATOS ---
    let displayEntities = entities;
    let displayRels = relationships;

    if (filterMode === 'characters') {
      displayEntities = entities.filter(e => e.type === 'character');
      displayRels = relationships.filter(r => {
        const s = entities.find(e => e.id === r.sourceId);
        const t = entities.find(e => e.id === r.targetId);
        return s?.type === 'character' && t?.type === 'character';
      });
    } else if (filterMode === 'territory') {
      const locations = entities.filter(e => e.type === 'location');
      const locationIds = new Set(locations.map(l => l.id));

      const relsToLocation = relationships.filter(r => locationIds.has(r.sourceId) || locationIds.has(r.targetId));
      const connectedToLocationIds = new Set(relsToLocation.flatMap(r => [r.sourceId, r.targetId]));

      displayEntities = entities.filter(e => e.type === 'location' || connectedToLocationIds.has(e.id));
      displayRels = relsToLocation;
    }

    if (selectedId && selectedId !== 'all') {
      const neighbors = new Set<string>();
      neighbors.add(selectedId);
      displayRels.forEach(r => {
        if (r.sourceId === selectedId) neighbors.add(r.targetId);
        if (r.targetId === selectedId) neighbors.add(r.sourceId);
      });
      displayEntities = displayEntities.filter(e => neighbors.has(e.id));
      displayRels = displayRels.filter(r => neighbors.has(r.sourceId) && neighbors.has(r.targetId));
    }

    // --- 5. ESTRUCTURA MATEMÁTICA DE NODOS Y ENLACES ---
    const nodes: Node[] = displayEntities.map((d, i) => {
      const node: Node = {
        id: d.id,
        name: d.name,
        type: d.type,
        color: d.headerColor,
        imageUrl: d.imageUrl
      };

      if (selectedId && selectedId !== 'all') {
        if (d.id === selectedId) {
          node.fx = width / 2;
          node.fy = height / 2;
        } else {
          const others = displayEntities.filter(e => e.id !== selectedId);
          const idx = others.findIndex(e => e.id === d.id);
          const angle = (idx / Math.max(1, others.length)) * Math.PI * 2;
          const radius = 220;
          node.fx = width / 2 + Math.cos(angle) * radius;
          node.fy = height / 2 + Math.sin(angle) * radius;
        }
      }
      return node;
    });

    const links: Link[] = displayRels.map(d => ({
      source: d.sourceId,
      target: d.targetId,
      type: d.relationType,
      isPending: d.isPending
    } as any));

    // --- 6. SIMULACIÓN DE FÍSICAS (FUERZAS) ---
    const simulation = d3.forceSimulation<Node>(nodes)
      .force('link', d3.forceLink<Node, Link>(links).id(d => d.id).distance(220))
      .force('charge', d3.forceManyBody().strength(selectedId && selectedId !== 'all' ? 0 : -600))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(70));

    // --- 7. RENDERIZADO DE ENLACES (LÍNEAS) ---
    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', d => (d as any).isPending ? 'var(--primary)' : 'var(--border-color)') // Adaptativo
      .attr('stroke-opacity', d => (d as any).isPending ? 0.8 : 0.6)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', d => (d as any).isPending ? '4,4' : 'none');

    // Etiquetas textuales sobre los enlaces (Relaciones)
    const linkLabels = svg.append('g')
      .selectAll('text')
      .data(links)
      .join('text')
      .attr('font-size', '9px')
      .attr('fill', d => (d as any).isPending ? 'var(--primary)' : 'var(--text-muted)') // Adaptativo
      .attr('text-anchor', 'middle')
      .attr('font-family', 'JetBrains Mono')
      .attr('font-weight', 'bold')
      .attr('paint-order', 'stroke')
      .attr('stroke', 'var(--bg)') // Adaptativo al fondo
      .attr('stroke-width', '4px')
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
      .text(d => d.type);

    // --- 8. RENDERIZADO DE NODOS (CÍRCULOS) & DRAG EVENT ---
    const node = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')
      .on('click', (e, d) => setSelectedId(d.id))
      .call(d3.drag<any, any>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Círculo base (Pintado con color, variable nativa o Avatar)
    node.append('circle')
      .attr('r', d => d.id === selectedId ? 40 : 32)
      .attr('fill', d => {
        if (d.imageUrl) return `url(#pattern-${d.id})`;
        return d.color || (d.type === 'character' ? 'var(--primary)' : 'var(--secondary)'); // Colores dinámicos como fallback
      })
      .attr('stroke', d => d.id === selectedId ? 'var(--text)' : 'var(--border-color)') // Adaptativo
      .attr('stroke-width', d => d.id === selectedId ? 5 : 2)
      .style('filter', d => d.id === selectedId ? 'drop-shadow(0 0 15px var(--primary))' : 'none');

    // Nombres de los nodos
    node.append('text')
      .text(d => d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', 55)
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', 'var(--text)') // Adaptativo
      .attr('class', 'drop-shadow-md');

    // Actualización de físicas por cada tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as any).x)
        .attr('y1', d => (d.source as any).y)
        .attr('x2', d => (d.target as any).x)
        .attr('y2', d => (d.target as any).y);

      linkLabels
        .attr('x', d => ((d.source as any).x + (d.target as any).x) / 2)
        .attr('y', d => ((d.source as any).y + (d.target as any).y) / 2 - 8);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // --- 9. EVENTOS DE ARRASTRE FISICO ---
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      if (!selectedId || selectedId === 'all') {
        event.subject.fx = null;
        event.subject.fy = null;
      }
    }

    return () => {
      simulation.stop();
    };
  }, [entities, relationships, selectedId, filterMode]);

  // ==========================================
  // DISEÑO VISUAL (RENDER)
  // ==========================================
  return (
    <div className="bg-[var(--bg-card)] rounded-[2rem] border border-brand-border overflow-hidden relative shadow-inner">
      
{/* Filtros de Categorías Superiores */}
      <div className="absolute top-6 left-6 z-10 flex flex-col gap-3">
        <div className="flex gap-2 bg-brand-card/30 backdrop-blur-xl p-1.5 rounded-2xl border border-brand-border">
          {[
            { id: 'all', label: 'Todo', icon: Globe },
            { id: 'characters', label: 'Personajes', icon: Users },
            { id: 'territory', label: 'Territorio', icon: MapPin }
          ].map(m => (
            <button
              key={m.id}
              onClick={() => {
                setFilterMode(m.id as any);
                setSelectedId(null);
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest cursor-pointer",
                filterMode === m.id
                  ? "bg-brand-primary text-zinc-950 shadow-lg" 
                  : "bg-brand-border text-brand-text hover:bg-brand-primary hover:text-zinc-950" 
              )}
            >
              <m.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          ))}
        </div>

        {/* Selector de Enfoque Individual (Foco en Nodo) */}
        <div className="flex items-center gap-3 bg-brand-border backdrop-blur-xl px-4 py-2 rounded-2xl border border-brand-border">
          <Filter className="w-4 h-4 text-brand-text opacity-80" />
          <select
            value={selectedId || ''}
            title="Filtrar por entidad"
            aria-label="Filtrar por entidad"
            onChange={(e) => setSelectedId(e.target.value || null)}
            className="bg-transparent border-none text-xs font-bold text-brand-text focus:ring-0 cursor-pointer appearance-none px-2"
          >
            <option value="" className="bg-brand-card text-brand-text">Enfoque en...</option>
            <option value="all" className="bg-brand-card text-brand-text">Ver Todo el Filtro</option>
            {entities
              .filter(e => {
                if (filterMode === 'characters') return e.type === 'character';
                if (filterMode === 'territory') return e.type === 'location';
                return true;
              })
              .map(e => (
                <option key={e.id} value={e.id} className="bg-brand-card text-brand-text">
                  {e.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Botón de Restablecer Enfoque (Maximizar) */}
      <button
        onClick={() => setSelectedId('all')}
        className="absolute top-6 right-6 p-3 bg-brand-card/80 hover:bg-brand-card backdrop-blur-md rounded-2xl text-brand-muted hover:text-brand-primary transition-all border border-brand-border cursor-pointer"
        title="Restablecer vista"
      >
        <Maximize2 className="w-5 h-5" />
      </button>

      {/* Canvas donde D3 inyecta el grafo SVG */}
      <svg ref={svgRef} className="w-full h-[600px] transition-colors duration-300" />
    </div>
  );
}