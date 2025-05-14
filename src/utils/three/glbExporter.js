import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';
import { MeshBVH } from 'three-mesh-bvh';

// 모듈을 GLB 파일로 내보내는 함수
export const exportModuleToGLB = async (moduleState) => {
  try {
    // 씬 생성
    const scene = new THREE.Scene();
    
    // 모듈 정보 확인
    const modules = moduleState.modules || [];
    if (modules.length === 0) {
      throw new Error('내보낼 모듈이 없습니다');
    }
    
    // 모듈별 메시 생성
    for (const module of modules) {
      const meshes = createModuleMeshes(module);
      meshes.forEach(mesh => scene.add(mesh));
    }
    
    // GLB 파일로 내보내기
    const exporter = new GLTFExporter();
    
    // 메타데이터 추가 (모듈 정보를 JSON으로 포함)
    const userData = {
      moduleData: JSON.stringify(moduleState)
    };
    
    scene.userData = userData;
    
    // 내보내기 옵션
    const options = {
      binary: true,
      onlyVisible: true,
      embedImages: true,
      includeCustomExtensions: true,
      // 원본 모듈 데이터를 extras에 포함
      trs: true // 회전, 위치, 크기 정보를 포함
    };
    
    // GLB 내보내기 실행
    const glbContent = await new Promise((resolve, reject) => {
      exporter.parse(
        scene,
        (result) => resolve(result),
        (error) => reject(error),
        options
      );
    });
    
    // 파일 다운로드
    downloadArrayBuffer(glbContent, `Furniture_${Date.now()}.glb`);
    
    return true;
  } catch (error) {
    console.error('GLB 내보내기 오류:', error);
    throw error;
  }
};

// 모듈 정보를 기반으로 3D 메시 생성
const createModuleMeshes = (module) => {
  const meshes = [];
  const { dimensions, panelThickness = 18, panels, shelves } = module;
  const thickness = panelThickness;
  const isRightModule = module.position === 'right';
  const hasLeftPanel = !isRightModule || (module.panels && module.panels.hasLeft !== false);
  
  // 재질 생성
  const material = new THREE.MeshStandardMaterial({
    color: 0xE0E0E0,
    roughness: 0.5,
    metalness: 0.2
  });
  
  // 상/하판 너비 계산
  const horizontalPanelWidth = isRightModule && !hasLeftPanel 
    ? dimensions.width - thickness 
    : dimensions.width - (thickness * 2);
  
  // 1. 상판 생성
  if (panels && panels.hasTop !== false) {
    const topGeometry = new THREE.BoxGeometry(
      horizontalPanelWidth,
      thickness,
      dimensions.depth
    );
    
    const topMesh = new THREE.Mesh(topGeometry, material);
    topMesh.position.set(
      dimensions.width / 2,
      dimensions.height - thickness / 2,
      dimensions.depth / 2
    );
    
    // 좌측 패널이 없는 경우 위치 조정
    if (isRightModule && !hasLeftPanel) {
      topMesh.position.x -= thickness / 2;
    }
    
    topMesh.userData = {
      moduleId: module.id,
      panelType: 'top',
      panelId: `${module.id}_top`,
      isModulePart: true
    };
    
    // BVH를 사용한 충돌 최적화
    topGeometry.computeBoundsTree = MeshBVH.computeBoundsTree;
    topGeometry.disposeBoundsTree = MeshBVH.disposeBoundsTree;
    topGeometry.computeBoundsTree();
    
    meshes.push(topMesh);
  }
  
  // 2. 하판 생성
  if (panels && panels.hasBottom !== false) {
    const bottomGeometry = new THREE.BoxGeometry(
      horizontalPanelWidth,
      thickness,
      dimensions.depth
    );
    
    const bottomMesh = new THREE.Mesh(bottomGeometry, material);
    bottomMesh.position.set(
      dimensions.width / 2,
      thickness / 2,
      dimensions.depth / 2
    );
    
    // 좌측 패널이 없는 경우 위치 조정
    if (isRightModule && !hasLeftPanel) {
      bottomMesh.position.x -= thickness / 2;
    }
    
    bottomMesh.userData = {
      moduleId: module.id,
      panelType: 'bottom',
      panelId: `${module.id}_bottom`,
      isModulePart: true
    };
    
    bottomGeometry.computeBoundsTree = MeshBVH.computeBoundsTree;
    bottomGeometry.disposeBoundsTree = MeshBVH.disposeBoundsTree;
    bottomGeometry.computeBoundsTree();
    
    meshes.push(bottomMesh);
  }
  
  // 3. 좌측판 생성
  if (panels && panels.hasLeft !== false && !isRightModule) {
    const leftGeometry = new THREE.BoxGeometry(
      thickness,
      dimensions.height - (thickness * 2),
      dimensions.depth
    );
    
    const leftMesh = new THREE.Mesh(leftGeometry, material);
    leftMesh.position.set(
      thickness / 2,
      dimensions.height / 2,
      dimensions.depth / 2
    );
    
    leftMesh.userData = {
      moduleId: module.id,
      panelType: 'left',
      panelId: `${module.id}_left`,
      isModulePart: true
    };
    
    leftGeometry.computeBoundsTree = MeshBVH.computeBoundsTree;
    leftGeometry.disposeBoundsTree = MeshBVH.disposeBoundsTree;
    leftGeometry.computeBoundsTree();
    
    meshes.push(leftMesh);
  }
  
  // 4. 우측판 생성
  if (panels && panels.hasRight !== false) {
    const rightGeometry = new THREE.BoxGeometry(
      thickness,
      dimensions.height - (thickness * 2),
      dimensions.depth
    );
    
    const rightMesh = new THREE.Mesh(rightGeometry, material);
    rightMesh.position.set(
      dimensions.width - thickness / 2,
      dimensions.height / 2,
      dimensions.depth / 2
    );
    
    rightMesh.userData = {
      moduleId: module.id,
      panelType: 'right',
      panelId: `${module.id}_right`,
      isModulePart: true
    };
    
    rightGeometry.computeBoundsTree = MeshBVH.computeBoundsTree;
    rightGeometry.disposeBoundsTree = MeshBVH.disposeBoundsTree;
    rightGeometry.computeBoundsTree();
    
    meshes.push(rightMesh);
  }
  
  // 5. 뒷판 생성
  if (panels && panels.hasBack !== false) {
    const backPanelHeight = dimensions.height - (thickness * 2);
    const backPanelWidth = horizontalPanelWidth;
    const backPanelThickness = 9; // 뒷판은 더 얇게
    
    const backGeometry = new THREE.BoxGeometry(
      backPanelWidth,
      backPanelHeight,
      backPanelThickness
    );
    
    const backMesh = new THREE.Mesh(backGeometry, material);
    backMesh.position.set(
      dimensions.width / 2,
      dimensions.height / 2,
      backPanelThickness / 2
    );
    
    // 좌측 패널이 없는 경우 위치 조정
    if (isRightModule && !hasLeftPanel) {
      backMesh.position.x -= thickness / 2;
    }
    
    backMesh.userData = {
      moduleId: module.id,
      panelType: 'back',
      panelId: `${module.id}_back`,
      isModulePart: true
    };
    
    backGeometry.computeBoundsTree = MeshBVH.computeBoundsTree;
    backGeometry.disposeBoundsTree = MeshBVH.disposeBoundsTree;
    backGeometry.computeBoundsTree();
    
    meshes.push(backMesh);
  }
  
  // 6. 선반 생성
  if (shelves && shelves.count > 0) {
    const shelfDepth = dimensions.depth - thickness - 20;
    
    // 선반 간격 계산
    const availableHeight = dimensions.height - (thickness * 2) - 10;
    const shelfSpacing = availableHeight / (shelves.count + 1);
    
    for (let i = 0; i < shelves.count; i++) {
      // 선반 가시성 확인
      let isVisible = true;
      if (shelves.visibility && Array.isArray(shelves.visibility)) {
        isVisible = shelves.visibility[i] !== false;
      }
      
      if (isVisible) {
        const shelfGeometry = new THREE.BoxGeometry(
          horizontalPanelWidth,
          thickness,
          shelfDepth
        );
        
        const shelfMesh = new THREE.Mesh(shelfGeometry, material);
        
        const shelfY = thickness + ((i + 1) * shelfSpacing);
        
        shelfMesh.position.set(
          dimensions.width / 2,
          shelfY,
          dimensions.depth / 2
        );
        
        // 좌측 패널이 없는 경우 위치 조정
        if (isRightModule && !hasLeftPanel) {
          shelfMesh.position.x -= thickness / 2;
        }
        
        shelfMesh.userData = {
          moduleId: module.id,
          panelType: 'shelf',
          panelId: `${module.id}_shelf_${i}`,
          shelfIndex: i,
          isModulePart: true
        };
        
        shelfGeometry.computeBoundsTree = MeshBVH.computeBoundsTree;
        shelfGeometry.disposeBoundsTree = MeshBVH.disposeBoundsTree;
        shelfGeometry.computeBoundsTree();
        
        meshes.push(shelfMesh);
      }
    }
  }
  
  return meshes;
};

// ArrayBuffer를 파일로 다운로드하는 유틸리티 함수
const downloadArrayBuffer = (arrayBuffer, fileName) => {
  const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
}; 