import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, PerspectiveCamera } from '@react-three/drei';
import { usePrymalReducedMotion } from '../../components/motion';

function getRgb(hex) {
  if (!hex || !hex.startsWith('#')) {
    return '104, 245, 208';
  }

  const normalized = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;
  const value = normalized.replace('#', '');

  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ].join(', ');
}

function SignalParticles({ reducedMotion }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 44 }, (_, index) => ({
        id: `particle-${index}`,
        radius: 2.2 + (index % 7) * 0.24,
        angle: (index / 44) * Math.PI * 2,
        y: ((index % 5) - 2) * 0.12,
        scale: 0.015 + (index % 5) * 0.008,
        speed: 0.12 + (index % 6) * 0.018,
      })),
    [],
  );

  return (
    <group>
      {particles.map((particle) => (
        <Particle key={particle.id} particle={particle} reducedMotion={reducedMotion} />
      ))}
    </group>
  );
}

function Particle({ particle, reducedMotion }) {
  const ref = useRef(null);

  useFrame((state) => {
    if (!ref.current || reducedMotion) {
      return;
    }

    const orbit = particle.angle + state.clock.elapsedTime * particle.speed;
    ref.current.position.x = Math.cos(orbit) * particle.radius;
    ref.current.position.z = Math.sin(orbit) * particle.radius;
    ref.current.position.y = particle.y + Math.sin(orbit * 1.7) * 0.12;
  });

  return (
    <mesh
      ref={ref}
      position={[
        Math.cos(particle.angle) * particle.radius,
        particle.y,
        Math.sin(particle.angle) * particle.radius,
      ]}
    >
      <sphereGeometry args={[particle.scale, 16, 16]} />
      <meshBasicMaterial color="#7fe0ff" transparent opacity={0.55} />
    </mesh>
  );
}

function AgentSatellite({ agent, index, count, reducedMotion }) {
  const groupRef = useRef(null);
  const ringRadius = 1.9 + (index % 2) * 0.45;
  const baseAngle = (index / count) * Math.PI * 2;

  useFrame((state) => {
    if (!groupRef.current) {
      return;
    }

    const orbit = baseAngle + (reducedMotion ? 0 : state.clock.elapsedTime * (0.16 + index * 0.01));
    groupRef.current.position.x = Math.cos(orbit) * ringRadius;
    groupRef.current.position.z = Math.sin(orbit) * ringRadius;
    groupRef.current.position.y = Math.sin(orbit * 1.8) * 0.24;
    groupRef.current.rotation.y = orbit * 0.85;
  });

  return (
    <Float speed={reducedMotion ? 0 : 1.8} rotationIntensity={reducedMotion ? 0 : 0.28} floatIntensity={reducedMotion ? 0 : 0.16}>
      <group ref={groupRef}>
        <mesh>
          <icosahedronGeometry args={[0.16, 2]} />
          <meshStandardMaterial
            color={agent.color}
            emissive={agent.color}
            emissiveIntensity={0.45}
            roughness={0.12}
            metalness={0.75}
          />
        </mesh>
        <mesh scale={1.55}>
          <icosahedronGeometry args={[0.16, 2]} />
          <meshBasicMaterial color={agent.color} transparent opacity={0.08} />
        </mesh>
      </group>
    </Float>
  );
}

function CoreRings({ reducedMotion }) {
  const ringsRef = useRef(null);

  useFrame((_, delta) => {
    if (!ringsRef.current || reducedMotion) {
      return;
    }

    ringsRef.current.rotation.z += delta * 0.12;
    ringsRef.current.rotation.x += delta * 0.05;
  });

  return (
    <group ref={ringsRef}>
      {[1.8, 2.45, 3.05].map((radius, index) => (
        <mesh
          key={`ring-${radius}`}
          rotation={[Math.PI / 2 + index * 0.32, index * 0.3, 0]}
        >
          <torusGeometry args={[radius, 0.02, 18, 90]} />
          <meshBasicMaterial
            color={index === 1 ? '#7f8cff' : '#68f5d0'}
            transparent
            opacity={index === 1 ? 0.24 : 0.18}
          />
        </mesh>
      ))}
    </group>
  );
}

function IntelligenceCore({ agents, reducedMotion }) {
  const groupRef = useRef(null);

  useFrame((state, delta) => {
    if (!groupRef.current) {
      return;
    }

    const targetX = reducedMotion ? 0.14 : state.pointer.y * 0.22;
    const targetY = reducedMotion ? -0.2 : state.pointer.x * 0.42;

    groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * 0.06;
    groupRef.current.rotation.y += (targetY - groupRef.current.rotation.y) * 0.06;

    if (!reducedMotion) {
      groupRef.current.rotation.z += delta * 0.03;
    }
  });

  return (
    <group ref={groupRef}>
      <ambientLight intensity={1.3} />
      <directionalLight position={[4, 5, 3]} intensity={2.1} color="#d6ecff" />
      <pointLight position={[-4, -2, -3]} intensity={1.8} color="#68f5d0" />
      <pointLight position={[3, 2, 4]} intensity={1.4} color="#ff8a66" />

      <mesh>
        <icosahedronGeometry args={[0.82, 2]} />
        <meshStandardMaterial
          color="#91b9ff"
          emissive="#4f9dff"
          emissiveIntensity={0.95}
          roughness={0.16}
          metalness={0.65}
        />
      </mesh>

      <mesh scale={1.36}>
        <icosahedronGeometry args={[0.82, 2]} />
        <meshBasicMaterial color="#68f5d0" transparent opacity={0.08} />
      </mesh>

      <mesh rotation={[Math.PI / 4, Math.PI / 5, 0]}>
        <torusKnotGeometry args={[0.95, 0.048, 260, 26]} />
        <meshStandardMaterial
          color="#68f5d0"
          emissive="#68f5d0"
          emissiveIntensity={0.8}
          roughness={0.2}
          metalness={0.82}
        />
      </mesh>

      <CoreRings reducedMotion={reducedMotion} />
      {agents.map((agent, index) => (
        <AgentSatellite
          key={agent.id}
          agent={agent}
          index={index}
          count={agents.length}
          reducedMotion={reducedMotion}
        />
      ))}
      <SignalParticles reducedMotion={reducedMotion} />
    </group>
  );
}

export default function CinematicHeroScene({ agents = [] }) {
  const reducedMotion = usePrymalReducedMotion();
  const sceneAgents = agents.slice(0, 6);
  const accentGlow = getRgb(sceneAgents[0]?.color);
  const accentSecondary = getRgb(sceneAgents[1]?.color ?? '#7f8cff');

  if (reducedMotion) {
    return (
      <div
        className="prymal-cinematic-stage__fallback"
        style={{
          '--hero-accent-rgb': accentGlow,
          '--hero-accent-rgb-secondary': accentSecondary,
        }}
      >
        <div className="prymal-cinematic-stage__fallback-core" />
        <div className="prymal-cinematic-stage__fallback-ring prymal-cinematic-stage__fallback-ring--inner" />
        <div className="prymal-cinematic-stage__fallback-ring prymal-cinematic-stage__fallback-ring--outer" />
        {sceneAgents.map((agent) => (
          <span
            key={agent.id}
            className="prymal-cinematic-stage__fallback-node"
            style={{ '--node-accent': agent.color }}
          >
            {agent.name}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div
      className="prymal-cinematic-stage__canvas-wrap"
      style={{
        '--hero-accent-rgb': accentGlow,
        '--hero-accent-rgb-secondary': accentSecondary,
      }}
    >
      <Canvas
        dpr={[1, 1.6]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        className="prymal-cinematic-stage__canvas"
      >
        <PerspectiveCamera makeDefault position={[0, 0.8, 7.2]} fov={36} />
        <fog attach="fog" args={['#07090f', 7.2, 12.6]} />
        <IntelligenceCore agents={sceneAgents} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
