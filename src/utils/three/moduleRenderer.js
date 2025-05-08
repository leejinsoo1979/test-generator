import * as THREE from 'three';
import { computeModulePosition } from './moduleUtils';

// 다중 캐비닛 모듈 추가 함수
export function addMultiCabinetModule(scene, THREE, moduleState) {
  console.log('addMultiCabinetModule 호출됨:', moduleState.modules);
  
  // 이전 모델 제거 - filter 방식 대신 traverse 사용
  const toRemove = [];
  scene.traverse(child => {
    if (child.isMesh && child.userData.isModulePart) {
      toRemove.push(child);
    }
    if (child.isLineSegments && child.userData.isModuleOutline) {
      toRemove.push(child);
    }
  });
  
  toRemove.forEach(obj => scene.remove(obj));
  
  // 모듈이 없는 경우
  if (!moduleState.modules || moduleState.modules.length === 0) {
    console.log('렌더링할 모듈이 없습니다.');
    return;
  }
  
  // 모듈 그룹 분류
  const allModules = moduleState.modules;
  const lowerModule = allModules.find(m => m.type === 'lower' || m.position === 'base');
  const rightModules = allModules.filter(m => m.position === 'right');
  const topModules = allModules.filter(m => m.position === 'top');
  
  console.log('위치별 모듈 수:', {
    하부장: lowerModule ? 1 : 0,
    상부장: topModules.length,
    우측장: rightModules.length
  });
  
  // 기준점이 될 하부 모듈 (기준점 역할)
  if (!lowerModule) {
    console.error('기준 하부장 모듈을 찾을 수 없습니다');
    return;
  }
  
  // 모듈 렌더링 함수
  const renderModule = (module, moduleInfo) => {
    const { position, dimensions } = moduleInfo;
    const { width, height, depth } = dimensions;
    const thickness = module.panelThickness || 18;
    
    // 디버깅: 동기화 상태 확인
    console.log(`모듈 ${module.id} 렌더링:`, {
      position,
      dimensions,
      패널두께: thickness
    });
    
    // 재질에 따른 색상 및 텍스처 지정
    let materialColor = 0xffffff;
    let materialRoughness = 0.3;
    let materialMetalness = 0.05;
    
    switch(module.material) {
      case 'melamine_white':
        materialColor = 0xffffff;
        materialRoughness = 0.25;
        break;
      case 'melamine_oak':
        materialColor = 0xd4bc8b;
        materialRoughness = 0.35;
        break;
      case 'mdf_painted':
        materialColor = 0xe6e6e6;
        materialRoughness = 0.1;
        materialMetalness = 0.2;
        break;
      default:
        materialColor = 0xffffff;
    }
    
    // 모듈 위치에 따른 색상 구분 (구분하기 쉽게)
    if (module.position === 'right') {
      materialColor = 0xfff0e0; // 우측 모듈: 연한 주황색
    } else if (module.position === 'top') {
      materialColor = 0xf0f8ff; // 상부 모듈: 연한 푸른색
    }
    
    const material = new THREE.MeshStandardMaterial({ 
      color: materialColor,
      roughness: materialRoughness,
      metalness: materialMetalness
    });
    
    const panels = [];
    
    // 좌측판 여부 확인 (우측장인 경우 주로 false)
    const hasLeftPanel = module.panels && module.panels.hasLeft !== false;
    
    // 패널 위치 계산에 사용될 좌표
    let centerX = position.x + width / 2;
    let centerY = position.y + height / 2; 
    let centerZ = position.z;
    
    // 좌측판 (해당 역할이 true일 때만 추가)
    if (hasLeftPanel) {
      const leftPanel = new THREE.Mesh(
        new THREE.BoxGeometry(thickness, height, depth),
        material
      );
      leftPanel.position.set(position.x + thickness / 2, centerY, centerZ);
      leftPanel.userData.moduleId = module.id;
      leftPanel.userData.panelType = 'left';
      panels.push(leftPanel);
    }
    
    // 우측판 (해당 역할이 true일 때만 추가)
    if (module.panels && module.panels.hasRight !== false) {
      const rightPanel = new THREE.Mesh(
        new THREE.BoxGeometry(thickness, height, depth),
        material
      );
      rightPanel.position.set(position.x + width - thickness / 2, centerY, centerZ);
      rightPanel.userData.moduleId = module.id;
      rightPanel.userData.panelType = 'right';
      panels.push(rightPanel);
    }
    
    // 상판 (해당 역할이 true일 때만 추가)
    if (module.panels && module.panels.hasTop !== false) {
      const topPanel = new THREE.Mesh(
        new THREE.BoxGeometry(width, thickness, depth),
        material
      );
      topPanel.position.set(centerX, position.y + height - thickness / 2, centerZ);
      topPanel.userData.moduleId = module.id;
      topPanel.userData.panelType = 'top';
      panels.push(topPanel);
    }
    
    // 하판 (해당 역할이 true일 때만 추가)
    if (module.panels && module.panels.hasBottom !== false) {
      const bottomPanel = new THREE.Mesh(
        new THREE.BoxGeometry(width, thickness, depth),
        material
      );
      bottomPanel.position.set(centerX, position.y + thickness / 2, centerZ);
      bottomPanel.userData.moduleId = module.id;
      bottomPanel.userData.panelType = 'bottom';
      panels.push(bottomPanel);
    }
    
    // 뒷판 (해당 역할이 true일 때만 추가)
    if (module.panels && module.panels.hasBack !== false) {
      // 뒷판 크기 및 위치 계산
      let backPanelWidth = width - thickness * 2;
      let backPanelX = centerX;
      
      // 우측장 모듈에서 좌측판이 없는 경우 (hasLeft가 false)
      if (module.position === 'right' && module.panels && module.panels.hasLeft === false) {
        // 뒷판 너비 조정 - 좌측패널 두께만큼 추가
        backPanelWidth = width - thickness;
        // 뒷판 X위치 조정 - 좌측으로 두께/2만큼 이동
        backPanelX = centerX - thickness / 2;
      }
      
      const backPanel = new THREE.Mesh(
        new THREE.BoxGeometry(backPanelWidth, height - thickness * 2, thickness),
        material
      );
      backPanel.position.set(backPanelX, centerY, centerZ - depth / 2 + thickness / 2);
      backPanel.userData.moduleId = module.id;
      backPanel.userData.panelType = 'back';
      panels.push(backPanel);
    }
    
    // 모든 패널에 처리
    panels.forEach(panel => {
      panel.castShadow = true;
      panel.receiveShadow = true;
      panel.userData.isModulePart = true;
      panel.userData.modulePosition = module.position;
      panel.userData.moduleType = module.type;
      
      // 모델에 윤곽선 효과 직접 추가 (2D 모드에서 사용)
      const edgesGeometry = new THREE.EdgesGeometry(panel.geometry, 0);
      const edgesMaterial = new THREE.LineBasicMaterial({
        color: 0x000000,
        linewidth: 3
      });
      
      const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
      edges.visible = false; // 기본적으로 숨김 (2D 모드에서만 표시)
      edges.renderOrder = 999;
      edges.material.depthTest = false;
      panel.userData.outline2D = edges;
      panel.add(edges);
      
      scene.add(panel);
    });
    
    // 선반 추가
    const shelfCount = module.shelves ? module.shelves.count : 0;
    if (shelfCount > 0) {
      const shelfThickness = thickness;
      
      // 좌측 패널 여부에 따라 선반 너비 및 위치 조정
      let shelfWidth = width - (thickness * 2);
      let shelfX = centerX;
      
      // 우측장 모듈에서 좌측판이 없는 경우, 선반을 좌측으로 확장
      if (module.position === 'right' && !hasLeftPanel) {
        // 선반 너비 확장 (좌측 패널 두께만큼)
        shelfWidth = width - thickness;
        // 선반 위치 조정 (좌측으로)
        shelfX = centerX - thickness / 2;
      }
      
      const shelfDepth = depth - thickness;
      
      // 사용 가능한 내부 높이 계산
      const innerHeight = height - (thickness * 2);
      const spaceBetweenShelves = innerHeight / (shelfCount + 1);
      
      for (let i = 0; i < shelfCount; i++) {
        const shelfMesh = new THREE.Mesh(
          new THREE.BoxGeometry(shelfWidth, shelfThickness, shelfDepth),
          material
        );
        
        // 선반 위치 계산 (동일한 간격으로 배치)
        const shelfY = position.y + thickness + spaceBetweenShelves * (i + 1);
        shelfMesh.position.set(shelfX, shelfY, centerZ);
        
        shelfMesh.castShadow = true;
        shelfMesh.receiveShadow = true;
        shelfMesh.userData.isModulePart = true;
        shelfMesh.userData.moduleId = module.id;
        shelfMesh.userData.panelType = 'shelf';
        
        // 윤곽선 효과 추가
        const edgesGeometry = new THREE.EdgesGeometry(shelfMesh.geometry, 0);
        const edgesMaterial = new THREE.LineBasicMaterial({
          color: 0x000000,
          linewidth: 3
        });
        
        const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
        edges.visible = false;
        edges.renderOrder = 999;
        edges.material.depthTest = false;
        edges.userData.isModuleOutline = true;
        edges.userData.moduleId = shelfMesh.userData.moduleId;
        shelfMesh.userData.outline2D = edges;
        shelfMesh.add(edges);
        
        scene.add(shelfMesh);
      }
    }
  };
  
  // 모든 모듈 렌더링
  allModules.forEach(module => {
    const moduleInfo = computeModulePosition(module, allModules);
    renderModule(module, moduleInfo);
  });
}

// 기존 단일 모듈용 함수 (이전 코드와의 호환성 위해 유지)
export function addCabinetModule(scene, THREE, moduleState) {
  // 모듈 구조로 변환된 경우, 기존 모듈 형식으로 처리
  if (moduleState.modules && moduleState.modules.length > 0) {
    return addMultiCabinetModule(scene, THREE, moduleState);
  }
  
  // 이전 모델 제거
  const toRemove = [];
  scene.traverse(child => {
    if (child.isMesh && child.userData.isModulePart) {
      toRemove.push(child);
    }
  });
  toRemove.forEach(obj => scene.remove(obj));
  
  // 기존 필드 참조
  const { width, height, depth } = moduleState.dimensions || { width: 600, height: 1200, depth: 577 };
  const thickness = moduleState.panelThickness || 18;
  
  // 재질에 따른 색상 및 텍스처 지정
  let materialColor = 0xffffff;
  let materialRoughness = 0.3;
  let materialMetalness = 0.05;
  
  switch(moduleState.material) {
    case 'melamine_white':
      materialColor = 0xffffff;
      materialRoughness = 0.25;
      break;
    case 'melamine_oak':
      materialColor = 0xd4bc8b;
      materialRoughness = 0.35;
      break;
    case 'mdf_painted':
      materialColor = 0xe6e6e6;
      materialRoughness = 0.1;
      materialMetalness = 0.2;
      break;
    default:
      materialColor = 0xffffff;
  }
  
  const material = new THREE.MeshStandardMaterial({ 
    color: materialColor,
    roughness: materialRoughness,
    metalness: materialMetalness
  });

  const panels = [];
  
  // 패널 위치 계산에 사용될 좌표
  const centerX = 0;
  const centerY = height / 2;
  const centerZ = 0;
  
  // 좌측판 (해당 역할이 true일 때만 추가)
  if (moduleState.panels && moduleState.panels.hasLeft) {
    const leftPanel = new THREE.Mesh(
      new THREE.BoxGeometry(thickness, height, depth),
      material
    );
    leftPanel.position.set(-width / 2 + thickness / 2, height / 2, 0);
    panels.push(leftPanel);
  }
  
  // 우측판 (해당 역할이 true일 때만 추가)
  if (moduleState.panels && moduleState.panels.hasRight) {
    const rightPanel = new THREE.Mesh(
      new THREE.BoxGeometry(thickness, height, depth),
      material
    );
    rightPanel.position.set(width / 2 - thickness / 2, height / 2, 0);
    panels.push(rightPanel);
  }
  
  // 상판 (해당 역할이 true일 때만 추가)
  if (moduleState.panels && moduleState.panels.hasTop) {
    const topPanel = new THREE.Mesh(
      new THREE.BoxGeometry(width, thickness, depth),
      material
    );
    topPanel.position.set(0, height - thickness / 2, 0);
    panels.push(topPanel);
  }
  
  // 하판 (해당 역할이 true일 때만 추가)
  if (moduleState.panels && moduleState.panels.hasBottom) {
    const bottomPanel = new THREE.Mesh(
      new THREE.BoxGeometry(width, thickness, depth),
      material
    );
    bottomPanel.position.set(0, thickness / 2, 0);
    panels.push(bottomPanel);
  }
  
  // 뒷판 (해당 역할이 true일 때만 추가)
  if (moduleState.panels && moduleState.panels.hasBack) {
    const backPanel = new THREE.Mesh(
      new THREE.BoxGeometry(width - thickness * 2, height - thickness * 2, thickness),
      material
    );
    backPanel.position.set(0, centerY, -depth / 2 + thickness / 2);
    panels.push(backPanel);
  }

  // 그림자 설정과 윤곽선 처리를 모든 패널에 적용
  panels.forEach(panel => {
    panel.castShadow = true;
    panel.receiveShadow = true;
    panel.userData.isModulePart = true;  // 모듈 구성 부분임을 표시
    
    // 모델에 윤곽선 효과 직접 추가 (2D 모드에서 사용)
    const edgesGeometry = new THREE.EdgesGeometry(panel.geometry, 0);
    const edgesMaterial = new THREE.LineBasicMaterial({
      color: 0x000000,
      linewidth: 3
    });
    
    const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    edges.visible = false; // 기본적으로 숨김 (2D 모드에서만 표시)
    edges.renderOrder = 999;
    edges.material.depthTest = false;
    panel.userData.outline2D = edges;
    panel.add(edges);
    
    scene.add(panel);
  });
  
  // 선반 추가
  const shelfCount = moduleState.shelves ? moduleState.shelves.count : 0;
  if (shelfCount > 0) {
    const shelfThickness = thickness;
    const shelfWidth = width - (thickness * 2);
    const shelfDepth = depth - thickness;
    
    // 사용 가능한 내부 높이 계산
    const innerHeight = height - (thickness * 2);
    const spaceBetweenShelves = innerHeight / (shelfCount + 1);
    
    for (let i = 0; i < shelfCount; i++) {
      const shelfMesh = new THREE.Mesh(
        new THREE.BoxGeometry(shelfWidth, shelfThickness, shelfDepth),
        material
      );
      
      // 선반 위치 계산 (동일한 간격으로 배치)
      const shelfY = thickness + spaceBetweenShelves * (i + 1);
      shelfMesh.position.set(0, shelfY, 0);
      
      shelfMesh.castShadow = true;
      shelfMesh.receiveShadow = true;
      shelfMesh.userData.isModulePart = true;  // 모듈 구성 부분임을 표시
      
      // 윤곽선 효과 추가
      const edgesGeometry = new THREE.EdgesGeometry(shelfMesh.geometry, 0);
      const edgesMaterial = new THREE.LineBasicMaterial({
        color: 0x000000,
        linewidth: 3
      });
      
      const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
      edges.visible = false;
      edges.renderOrder = 999;
      edges.material.depthTest = false;
      edges.userData.isModuleOutline = true;
      shelfMesh.userData.outline2D = edges;
      shelfMesh.add(edges);
      
      scene.add(shelfMesh);
    }
  }
} 