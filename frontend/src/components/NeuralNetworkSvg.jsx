import React from 'react';

export default function NeuralNetworkSvg() {
  // Layer coordinates for neural network graph
  const nodes = [
    // Input layer (x: 80)
    { id: 'i1', x: 80, y: 100, label: 'RC' },
    { id: 'i2', x: 80, y: 220, label: 'DL' },
    { id: 'i3', x: 80, y: 340, label: 'EST' },
    { id: 'i4', x: 80, y: 460, label: 'FIR' },

    // Hidden layer 1 (x: 240)
    { id: 'h1_1', x: 240, y: 80 },
    { id: 'h1_2', x: 240, y: 180 },
    { id: 'h1_3', x: 240, y: 280 },
    { id: 'h1_4', x: 240, y: 380 },
    { id: 'h1_5', x: 240, y: 480 },

    // Hidden layer 2 (x: 440)
    { id: 'h2_1', x: 440, y: 120 },
    { id: 'h2_2', x: 440, y: 240 },
    { id: 'h2_3', x: 440, y: 360 },
    { id: 'h2_4', x: 440, y: 460 },

    // Policy & Gate layer (x: 620)
    { id: 'g1', x: 620, y: 180, label: 'POL-2.1' },
    { id: 'g2', x: 620, y: 300, label: 'POL-5.1' },
    { id: 'g3', x: 620, y: 420, label: 'POL-7.2' },

    // Output node (x: 760)
    { id: 'out', x: 760, y: 290, label: 'VERIFIED' }
  ];

  // Connections (synaptic edges)
  const edges = [
    ['i1', 'h1_1'], ['i1', 'h1_2'], ['i2', 'h1_2'], ['i2', 'h1_3'],
    ['i3', 'h1_3'], ['i3', 'h1_4'], ['i4', 'h1_4'], ['i4', 'h1_5'],
    ['h1_1', 'h2_1'], ['h1_2', 'h2_1'], ['h1_2', 'h2_2'], ['h1_3', 'h2_2'],
    ['h1_3', 'h2_3'], ['h1_4', 'h2_3'], ['h1_4', 'h2_4'], ['h1_5', 'h2_4'],
    ['h2_1', 'g1'], ['h2_2', 'g1'], ['h2_2', 'g2'], ['h2_3', 'g2'],
    ['h2_3', 'g3'], ['h2_4', 'g3'],
    ['g1', 'out'], ['g2', 'out'], ['g3', 'out']
  ];

  const getNode = (id) => nodes.find(n => n.id === id);

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-40 md:opacity-60 overflow-hidden">
      <svg
        viewBox="0 0 840 560"
        className="w-full h-full max-w-5xl max-h-[580px] select-none"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Subtle gradient for connections */}
          <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4f76c8" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#7c5cbf" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#4f76c8" stopOpacity="0.2" />
          </linearGradient>

          {/* Active travelling pulse gradient */}
          <linearGradient id="pulseGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4f76c8" stopOpacity="0" />
            <stop offset="50%" stopColor="#e2e8f0" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#7c5cbf" stopOpacity="0" />
          </linearGradient>

          {/* Glow filter */}
          <filter id="nodeGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Static Base Edges */}
        {edges.map(([fromId, toId], idx) => {
          const from = getNode(fromId);
          const to = getNode(toId);
          if (!from || !to) return null;
          return (
            <line
              key={`base-${idx}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="url(#edgeGrad)"
              strokeWidth="1.2"
              strokeDasharray="4 4"
            />
          );
        })}

        {/* Animated Travelling Pulses along key paths */}
        {edges.filter((_, idx) => idx % 2 === 0).map(([fromId, toId], idx) => {
          const from = getNode(fromId);
          const to = getNode(toId);
          if (!from || !to) return null;
          return (
            <g key={`anim-${idx}`}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="#7c5cbf"
                strokeWidth="2"
                strokeDasharray="14 180"
                className="animate-[neuralEdgePulse_4s_linear_infinite]"
                style={{
                  animationDuration: `${3 + (idx % 3)}s`,
                  animationDelay: `${idx * 0.4}s`
                }}
              />
              {/* Traveling light particle */}
              <circle r="2.5" fill="#e2e8f0" filter="url(#nodeGlow)">
                <animateMotion
                  path={`M ${from.x} ${from.y} L ${to.x} ${to.y}`}
                  dur={`${2.5 + (idx % 2)}s`}
                  repeatCount="indefinite"
                  begin={`${(idx * 0.5) % 3}s`}
                />
              </circle>
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const isKeyNode = node.label !== undefined;
          return (
            <g key={node.id} className="cursor-default">
              {/* Outer pulsing ring for key nodes */}
              {isKeyNode && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="14"
                  fill="none"
                  stroke="#4f76c8"
                  strokeWidth="1"
                  strokeOpacity="0.4"
                  className="animate-pulse"
                />
              )}
              {/* Node body */}
              <circle
                cx={node.x}
                cy={node.y}
                r={isKeyNode ? 7 : 4}
                fill={isKeyNode ? '#7c5cbf' : '#4f76c8'}
                fillOpacity="0.85"
                stroke="#080c18"
                strokeWidth="2"
                filter="url(#nodeGlow)"
              />
              {/* Node label if available */}
              {node.label && (
                <text
                  x={node.x}
                  y={node.y + 18}
                  fill="#94a3b8"
                  fontSize="9"
                  fontFamily="'JetBrains Mono', monospace"
                  textAnchor="middle"
                  opacity="0.75"
                >
                  {node.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
