'use client';

import { Suspense, useEffect, useLayoutEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows, useGLTF, useAnimations, useTexture } from '@react-three/drei';
import * as THREE from 'three';

export interface GltfOptions {
  url: string;
  playing: boolean;
  bodyScale?: number; // morphologie (largeur)
  sizeScale?: number; // taille de vêtement (échelle globale)
  garmentTextureUrl?: string; // texture produit appliquée au corps
}

/** Applique une texture produit sur tous les meshes du modèle (try-on). */
function ApplyGarment({ target, url }: { target: THREE.Object3D; url: string }) {
  const tex = useTexture(url);
  useEffect(() => {
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const restore: Array<[THREE.Mesh, THREE.Material | THREE.Material[]]> = [];
    target.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        restore.push([mesh, mesh.material]);
        const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).clone() as THREE.MeshStandardMaterial;
        mat.map = tex;
        if ('color' in mat) (mat.color as THREE.Color).set('#ffffff');
        mat.needsUpdate = true;
        mesh.material = mat;
      }
    });
    return () => {
      restore.forEach(([mesh, mat]) => (mesh.material = mat));
    };
  }, [target, tex]);
  return null;
}

function GltfModel({ url, playing, bodyScale = 1, sizeScale = 1, garmentTextureUrl }: GltfOptions) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(url);
  const model = scene;
  const { actions, names } = useAnimations(animations, group);

  // Auto-centrage + mise à l'échelle (pieds au sol), robuste aux SkinnedMesh
  useLayoutEffect(() => {
    model.position.set(0, 0, 0);
    model.scale.setScalar(1);
    model.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxAxis = Math.max(size.x, size.y, size.z);
    // Garde-fou : box invalide/vide → ne pas mettre à l'échelle (évite scale Infinity)
    if (Number.isFinite(maxAxis) && maxAxis > 0.001) {
      const s = 2.5 / maxAxis;
      model.scale.setScalar(s);
      model.position.set(-center.x * s, -box.min.y * s, -center.z * s);
    }
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
  }, [model]);

  // Morphologie (largeur) + taille (échelle globale)
  useEffect(() => {
    if (group.current) group.current.scale.set(bodyScale * sizeScale, sizeScale, bodyScale * sizeScale);
  }, [bodyScale, sizeScale]);

  // Animation : marche pour le défilé
  useEffect(() => {
    if (!names.length) return;
    const walk = names.find((n) => /walk|marche|run|défil/i.test(n)) ?? names[0];
    const action = actions[walk!];
    if (!action) return;
    if (playing) action.reset().fadeIn(0.3).play();
    else action.fadeOut(0.3);
    return () => {
      action.stop();
    };
  }, [actions, names, playing]);

  return (
    <group ref={group}>
      <primitive object={model} />
      {garmentTextureUrl && (
        <Suspense fallback={null}>
          <ApplyGarment target={model} url={garmentTextureUrl} />
        </Suspense>
      )}
    </group>
  );
}

export default function GltfViewer(opts: GltfOptions) {
  return (
    <Canvas shadows camera={{ position: [0, 1.4, 4.8], fov: 42 }} dpr={[1, 2]}>
      <color attach="background" args={['#0a0710']} />
      <ambientLight intensity={0.6} />
      <spotLight position={[4, 8, 5]} angle={0.4} penumbra={0.8} intensity={150} castShadow color="#ffffff" />
      <pointLight position={[-5, 3, -3]} intensity={45} color="#7c3aed" />
      <pointLight position={[5, 2, -4]} intensity={35} color="#3b82f6" />

      <Suspense fallback={null}>
        {/* key force le remount au changement de modèle/texture pour un état propre */}
        <GltfModel key={`${opts.url}|${opts.garmentTextureUrl ?? ''}`} {...opts} />
      </Suspense>

      <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={8} blur={2.4} far={4} />
      <OrbitControls
        enablePan={false}
        minDistance={2.5}
        maxDistance={9}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 1.8}
        target={[0, 1.1, 0]}
        autoRotate={!opts.playing}
        autoRotateSpeed={1.2}
      />
    </Canvas>
  );
}

useGLTF.preload('/models/femme.glb');
