'use client';

import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows, useTexture } from '@react-three/drei';
import * as THREE from 'three';

export interface MannequinOptions {
  garmentColor: string;
  skinColor: string;
  bodyScale: number; // largeur du torse (morphologie)
  garmentTextureUrl?: string; // image produit appliquée comme texture
}

/** Mannequin humanoïde paramétrique. Le vêtement peut recevoir une texture (try-on). */
function Mannequin({
  garmentColor,
  skinColor,
  bodyScale,
  clothMap,
}: {
  garmentColor: string;
  skinColor: string;
  bodyScale: number;
  clothMap?: THREE.Texture;
}) {
  const skin = useMemo(
    () => new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6, metalness: 0.05 }),
    [skinColor],
  );
  const cloth = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: clothMap ? '#ffffff' : garmentColor,
        map: clothMap ?? null,
        roughness: 0.5,
        metalness: 0.08,
      }),
    [garmentColor, clothMap],
  );

  return (
    <group position={[0, 0, 0]}>
      {/* Tête */}
      <mesh position={[0, 2.5, 0]} castShadow material={skin}>
        <sphereGeometry args={[0.32, 32, 32]} />
      </mesh>
      {/* Cou */}
      <mesh position={[0, 2.15, 0]} castShadow material={skin}>
        <cylinderGeometry args={[0.12, 0.14, 0.25, 16]} />
      </mesh>
      {/* Torse (vêtement) */}
      <mesh position={[0, 1.5, 0]} scale={[bodyScale, 1, 0.7]} castShadow material={cloth}>
        <capsuleGeometry args={[0.42, 0.7, 8, 24]} />
      </mesh>
      {/* Bassin (vêtement) */}
      <mesh position={[0, 0.95, 0]} scale={[bodyScale * 0.95, 1, 0.7]} castShadow material={cloth}>
        <cylinderGeometry args={[0.34, 0.3, 0.4, 24]} />
      </mesh>
      {/* Bras (peau) */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (0.5 * bodyScale + 0.08), 1.55, 0]} rotation={[0, 0, s * 0.12]} castShadow material={skin}>
          <capsuleGeometry args={[0.1, 0.95, 8, 16]} />
        </mesh>
      ))}
      {/* Jambes (vêtement) */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.18, 0.4, 0]} castShadow material={cloth}>
          <capsuleGeometry args={[0.14, 0.9, 8, 16]} />
        </mesh>
      ))}
      {/* Pieds (peau) */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.18, -0.08, 0.08]} castShadow material={skin}>
          <boxGeometry args={[0.18, 0.12, 0.4]} />
        </mesh>
      ))}
    </group>
  );
}

/** Variante qui charge la texture produit puis l'applique au vêtement. */
function TexturedMannequin({
  url,
  garmentColor,
  skinColor,
  bodyScale,
}: {
  url: string;
  garmentColor: string;
  skinColor: string;
  bodyScale: number;
}) {
  const tex = useTexture(url);
  useMemo(() => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1.5, 1.5);
    tex.colorSpace = THREE.SRGBColorSpace;
  }, [tex]);
  return <Mannequin garmentColor={garmentColor} skinColor={skinColor} bodyScale={bodyScale} clothMap={tex} />;
}

// Face, 45° gauche, profil gauche, 45° droite, dos
const RUNWAY_ANGLES = [0, -Math.PI / 4, -Math.PI / 2, Math.PI / 4, Math.PI];

function Stage({
  options,
  playing,
  onStep,
}: {
  options: MannequinOptions;
  playing: boolean;
  onStep: (i: number) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const idx = useRef(0);
  const acc = useRef(0);

  useFrame((_, delta) => {
    if (!group.current || !playing) return;
    acc.current += delta;
    if (acc.current > 1.8) {
      acc.current = 0;
      idx.current = (idx.current + 1) % RUNWAY_ANGLES.length;
      onStep(idx.current);
    }
    const target = RUNWAY_ANGLES[idx.current]!;
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, target, 0.06);
  });

  return (
    <group ref={group}>
      {options.garmentTextureUrl ? (
        <Suspense
          fallback={
            <Mannequin garmentColor={options.garmentColor} skinColor={options.skinColor} bodyScale={options.bodyScale} />
          }
        >
          <TexturedMannequin
            url={options.garmentTextureUrl}
            garmentColor={options.garmentColor}
            skinColor={options.skinColor}
            bodyScale={options.bodyScale}
          />
        </Suspense>
      ) : (
        <Mannequin garmentColor={options.garmentColor} skinColor={options.skinColor} bodyScale={options.bodyScale} />
      )}
    </group>
  );
}

export default function Showroom({
  options,
  playing,
  onStep,
}: {
  options: MannequinOptions;
  playing: boolean;
  onStep: (i: number) => void;
}) {
  return (
    <Canvas shadows camera={{ position: [0, 1.4, 5], fov: 42 }} dpr={[1, 2]}>
      <color attach="background" args={['#0a0710']} />
      <ambientLight intensity={0.5} />
      <spotLight position={[4, 8, 5]} angle={0.4} penumbra={0.8} intensity={140} castShadow color="#ffffff" />
      <pointLight position={[-5, 3, -3]} intensity={40} color="#7c3aed" />
      <pointLight position={[5, 2, -4]} intensity={35} color="#3b82f6" />

      <Stage options={options} playing={playing} onStep={onStep} />

      <ContactShadows position={[0, -0.2, 0]} opacity={0.5} scale={8} blur={2.4} far={4} />
      <OrbitControls
        enablePan={false}
        minDistance={3}
        maxDistance={9}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 1.8}
        target={[0, 1.1, 0]}
        autoRotate={!playing}
        autoRotateSpeed={1.2}
      />
    </Canvas>
  );
}
