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
  const lowerModule = allModules.find(m => m.type === 'lower' && m.position !== 'right');
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
    
    // 기본 재질 색상을 연한 그레이로 설정
    const materialColor = 0xE0E0E0; // 연한 그레이 색상
    let materialRoughness = 0.3;
    let materialMetalness = 0.05;
    
    // 재질 속성 설정 (모든 패널은 기본적으로 연한 그레이 사용)
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
    
    // 패널 간 체결 구조에 따른 크기 조정
    // 1. 좌/우측 패널: 전체 높이 x 두께 x 전체 깊이
    // 2. 상/하판: (전체 너비 - 좌우측 패널 두께) x 두께 x 전체 깊이
    // 3. 뒷판: (전체 너비 - 좌우측 패널 두께) x (전체 높이 - 상하판 두께) x 뒷판 두께(9mm)
    
    // 우측장인 경우 특수 처리
    const isRightModule = module.position === 'right';
    
    // 상/하판 너비 계산
    let horizontalPanelWidth;
    
    // 우측장이고 좌측 패널이 없는 경우 (하부장과 붙는 구조)
    if (isRightModule && !hasLeftPanel) {
      // 좌측 패널이 없으므로 너비에서 우측 패널 두께만 고려
      horizontalPanelWidth = width - thickness;
    } else {
      // 일반적인 경우 양쪽 패널 두께 고려
      horizontalPanelWidth = width - (thickness * 2);
    }
    
    // 생성된 패널에 와이어프레임 추가하는 헬퍼 함수
    const addWireframe = (mesh) => {
      // 윤곽선 (와이어프레임) 효과 생성
      const edgesGeometry = new THREE.EdgesGeometry(mesh.geometry, 1);
      const edgesMaterial = new THREE.LineBasicMaterial({
        color: 0x000000,
        linewidth: 2
      });
      
      const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
      edges.visible = false; // 기본적으로 숨김 (2D 모드에서만 표시)
      edges.renderOrder = 999;
      edges.material.depthTest = false;
      edges.userData.isModuleOutline = true;
      
      // 패널 메타 정보 공유
      if (mesh.userData.moduleId) {
        edges.userData.moduleId = mesh.userData.moduleId;
      }
      if (mesh.userData.panelId) {
        edges.userData.panelId = mesh.userData.panelId;
      }
      if (mesh.userData.panelType) {
        edges.userData.panelType = mesh.userData.panelType;
      }
      
      mesh.userData.outline2D = edges;
      mesh.add(edges);
      
      return mesh;
    };
    
    // 좌측판 (해당 역할이 true일 때만 추가)
    if (module.panels && module.panels.hasLeft && !isRightModule) {
      const leftPanel = new THREE.Mesh(
        new THREE.BoxGeometry(thickness, height, depth),
        material
      );
      
      leftPanel.position.set(position.x + thickness / 2, position.y + height / 2, centerZ);
      leftPanel.castShadow = true;
      leftPanel.receiveShadow = true;
      leftPanel.userData.isModulePart = true;
      leftPanel.userData.moduleId = module.id;
      leftPanel.userData.panelType = 'left';
      leftPanel.userData.panelId = `${module.id}_left`;
      
      // 와이어프레임 추가
      addWireframe(leftPanel);
      
      // 씬에 추가
      scene.add(leftPanel);
    }
    
    // 우측판 (해당 역할이 true일 때만 추가)
    if (module.panels && module.panels.hasRight) {
      const rightPanel = new THREE.Mesh(
        new THREE.BoxGeometry(thickness, height, depth),
        material
      );
      
      rightPanel.position.set(position.x + width - thickness / 2, position.y + height / 2, centerZ);
      rightPanel.castShadow = true;
      rightPanel.receiveShadow = true;
      rightPanel.userData.isModulePart = true;
      rightPanel.userData.moduleId = module.id;
      rightPanel.userData.panelType = 'right';
      rightPanel.userData.panelId = `${module.id}_right`;
      
      // 와이어프레임 추가
      addWireframe(rightPanel);
      
      // 씬에 추가
      scene.add(rightPanel);
    }
    
    // 상판 (해당 역할이 true일 때만 추가)
    if (module.panels && module.panels.hasTop !== false) {
      const topPanel = new THREE.Mesh(
        new THREE.BoxGeometry(horizontalPanelWidth, thickness, depth),
        material
      );
      
      // 패널 위치 계산 (좌우 패널 사이)
      let topPanelX;
      
      if (isRightModule && !hasLeftPanel) {
        // 우측장이고 좌측 패널이 없는 경우
        topPanelX = position.x + horizontalPanelWidth / 2;
      } else {
        // 일반적인 경우
        topPanelX = position.x + thickness + horizontalPanelWidth / 2;
      }
      
      topPanel.position.set(topPanelX, position.y + height - thickness / 2, centerZ);
      topPanel.castShadow = true;
      topPanel.receiveShadow = true;
      topPanel.userData.isModulePart = true;
      topPanel.userData.moduleId = module.id;
      topPanel.userData.panelType = 'top';
      topPanel.userData.panelId = `${module.id}_top`;
      
      // 와이어프레임 추가
      addWireframe(topPanel);
      
      // 씬에 추가
      scene.add(topPanel);
    }
    
    // 하판 (해당 역할이 true일 때만 추가)
    if (module.panels && module.panels.hasBottom !== false) {
      const bottomPanel = new THREE.Mesh(
        new THREE.BoxGeometry(horizontalPanelWidth, thickness, depth),
        material
      );
      
      // 패널 위치 계산 (좌우 패널 사이)
      let bottomPanelX;
      
      if (isRightModule && !hasLeftPanel) {
        // 우측장이고 좌측 패널이 없는 경우
        bottomPanelX = position.x + horizontalPanelWidth / 2;
      } else {
        // 일반적인 경우
        bottomPanelX = position.x + thickness + horizontalPanelWidth / 2;
      }
      
      bottomPanel.position.set(bottomPanelX, position.y + thickness / 2, centerZ);
      bottomPanel.castShadow = true;
      bottomPanel.receiveShadow = true;
      bottomPanel.userData.isModulePart = true;
      bottomPanel.userData.moduleId = module.id;
      bottomPanel.userData.panelType = 'bottom';
      bottomPanel.userData.panelId = `${module.id}_bottom`;
      
      // 와이어프레임 추가
      addWireframe(bottomPanel);
      
      // 씬에 추가
      scene.add(bottomPanel);
    }
    
    // 뒷판 (해당 역할이 true일 때만 추가)
    if (module.panels && module.panels.hasBack !== false) {
      // 뒷판 크기 및 위치 계산
      let backPanelWidth = horizontalPanelWidth;
      let backPanelHeight = height - (thickness * 2);
      let backPanelX = position.x + thickness + backPanelWidth / 2;
      
      // 우측장 모듈에서 좌측판이 없는 경우 (hasLeft가 false)
      if (module.position === 'right' && module.panels && module.panels.hasLeft === false) {
        // 뒷판 너비 조정 - 좌측패널이 없으므로 더 넓게 설정
        backPanelWidth = width - thickness;
        // 뒷판 X위치 조정
        backPanelX = position.x + backPanelWidth / 2;
      }
      
      // 백패널 전용 두께 (9mm로 설정)
      const backPanelThickness = 9;
      
      const backPanel = new THREE.Mesh(
        new THREE.BoxGeometry(backPanelWidth, backPanelHeight, backPanelThickness),
        material
      );
      // Z축 위치 조정 - 백패널을 뒤쪽으로 20mm 이동
      backPanel.position.set(backPanelX, position.y + thickness + backPanelHeight / 2, centerZ - depth / 2 + backPanelThickness / 2 + 20);
      backPanel.userData.moduleId = module.id;
      backPanel.userData.panelType = 'back';
      backPanel.userData.panelId = `${module.id}_back`;
      
      // 와이어프레임 추가
      addWireframe(backPanel);
      
      scene.add(backPanel);
    }
    
    // 선반 추가
    const shelfCount = module.shelves ? module.shelves.count : 0;
    if (shelfCount > 0) {
      const shelfThickness = thickness;
      
      // 선반 너비 계산 (좌우 패널 사이에 맞춤)
      let shelfWidth = horizontalPanelWidth;
      let shelfX = position.x + thickness + shelfWidth / 2;
      
      // 우측장 모듈에서 좌측판이 없는 경우, 선반 너비와 위치 조정
      if (module.position === 'right' && !hasLeftPanel) {
        // 선반 너비 확장 (좌측 패널 두께만큼)
        shelfWidth = width - thickness;
        // 선반 위치 조정 (좌측으로)
        shelfX = position.x + shelfWidth / 2;
      }
      
      // 선반 깊이 20mm 감소 (백패널이 20mm 앞으로 이동하므로)
      const shelfDepth = depth - thickness - 20;
      
      // 사용 가능한 내부 높이 계산
      const innerHeight = height - (thickness * 2);
      const spaceBetweenShelves = innerHeight / (shelfCount + 1);
      
      // 선반 가시성 배열 확인 및 초기화
      let shelfVisibility = [];
      
      // 선반 가시성 배열이 있는지 확인하고 없으면 모두 보이게 설정
      if (module.shelves.visibility && Array.isArray(module.shelves.visibility)) {
        // 기존 가시성 배열 사용
        shelfVisibility = [...module.shelves.visibility];
        
        // 배열 길이가 선반 수량보다 작으면 부족한 만큼 true로 채움
        if (shelfVisibility.length < shelfCount) {
          const additionalVisibility = Array(shelfCount - shelfVisibility.length).fill(true);
          shelfVisibility = [...shelfVisibility, ...additionalVisibility];
        }
      } else {
        // 가시성 배열이 없는 경우 모두 보이도록 true로 초기화
        shelfVisibility = Array(shelfCount).fill(true);
      }
      
      console.log(`모듈 ${module.id}의 선반 가시성:`, shelfVisibility);
      
      for (let i = 0; i < shelfCount; i++) {
        const shelfMesh = new THREE.Mesh(
          new THREE.BoxGeometry(shelfWidth, shelfThickness, shelfDepth),
          material
        );
        
        // 선반 위치 계산 (동일한 간격으로 배치)
        const shelfY = position.y + thickness + spaceBetweenShelves * (i + 1);
        
        // 선반의 z축 위치를 조정하여 뒷면이 백패널과 맞닿도록 함 (백패널이 20mm 이동했으므로 선반도 10mm 이동)
        shelfMesh.position.set(shelfX, shelfY, centerZ + 10);
        
        shelfMesh.castShadow = true;
        shelfMesh.receiveShadow = true;
        shelfMesh.userData.isModulePart = true;
        shelfMesh.userData.moduleId = module.id;
        shelfMesh.userData.panelType = 'shelf';
        shelfMesh.userData.shelfIndex = i;
        
        // 선반 가시성 설정 - 가시성 배열 확인
        const isVisible = shelfVisibility[i] !== false;
        shelfMesh.visible = isVisible;
        
        // 선반 ID 설정 (패널 색상 및 가시성 제어용)
        shelfMesh.userData.panelId = `${module.id}_shelf_${i}`;
        
        // 와이어프레임 추가
        addWireframe(shelfMesh);
        
        scene.add(shelfMesh);
      }
    }
  };
  
  // 모든 모듈 렌더링
  allModules.forEach(module => {
    const moduleInfo = computeModulePosition(module, allModules);
    renderModule(module, moduleInfo);
  });
  
  // 모듈 간 연결 - 우측장과 하부장이 붙는 부분 처리
  // 하부장 찾기
  const lowerModuleBase = allModules.find(m => m.type === 'lower' && m.position !== 'right');
  // 우측장 찾기
  const rightModuleBase = allModules.find(m => m.position === 'right');
  
  // 하부장과 우측장이 모두 존재하면 위치 재조정
  if (lowerModuleBase && rightModuleBase) {
    // 하부장과 우측장의 위치 정보 계산
    const lowerModuleInfo = computeModulePosition(lowerModuleBase, allModules);
    const rightModuleInfo = computeModulePosition(rightModuleBase, allModules);
    
    // 하부장의 우측 끝 좌표 (우측 끝)
    const lowerRightEdge = lowerModuleInfo.position.x + lowerModuleInfo.dimensions.width;
    
    // 씬에서 우측장 관련 객체 찾기
    scene.traverse(object => {
      if (object.isMesh && object.userData.moduleId === rightModuleBase.id) {
        // 우측장 객체의 X 좌표 조정
        // 현재 위치에서 필요한 이동량 계산
        const xOffset = lowerRightEdge - rightModuleInfo.position.x;
        
        // X축 좌표 조정
        object.position.x += xOffset;
      }
    });
    
    console.log('우측장과 하부장의 위치가 연결되도록 조정되었습니다.');
  }
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
  
  // 기본 필드 참조
  const { width, height, depth } = moduleState.dimensions || { width: 600, height: 1200, depth: 577 };
  const thickness = moduleState.panelThickness || 18;
  
  // 기본 재질 색상을 연한 그레이로 설정
  const materialColor = 0xE0E0E0; // 연한 그레이 색상
  let materialRoughness = 0.3;
  let materialMetalness = 0.05;
  
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
  
  // 상/하판 너비 계산 (좌/우측 패널 사이에 위치)
  const horizontalPanelWidth = width - (thickness * 2);
  
  // 좌측판 (해당 역할이 true일 때만 추가)
  if (moduleState.panels && moduleState.panels.hasLeft) {
    const leftPanel = new THREE.Mesh(
      new THREE.BoxGeometry(thickness, height, depth),
      material
    );
    leftPanel.position.set(-width / 2 + thickness / 2, height / 2, 0);
    leftPanel.userData.isModulePart = true;
    leftPanel.userData.panelType = 'left';
    leftPanel.userData.panelId = `${moduleState.id}_left`;
    panels.push(leftPanel);
  }
  
  // 우측판 (해당 역할이 true일 때만 추가)
  if (moduleState.panels && moduleState.panels.hasRight) {
    const rightPanel = new THREE.Mesh(
      new THREE.BoxGeometry(thickness, height, depth),
      material
    );
    rightPanel.position.set(width / 2 - thickness / 2, height / 2, 0);
    rightPanel.userData.isModulePart = true;
    rightPanel.userData.panelType = 'right';
    rightPanel.userData.panelId = `${moduleState.id}_right`;
    panels.push(rightPanel);
  }
  
  // 상판 (해당 역할이 true일 때만 추가)
  if (moduleState.panels && moduleState.panels.hasTop) {
    const topPanel = new THREE.Mesh(
      new THREE.BoxGeometry(horizontalPanelWidth, thickness, depth),
      material
    );
    // 좌/우측 패널 사이에 위치하도록 조정
    topPanel.position.set(0, height - thickness / 2, 0);
    topPanel.userData.isModulePart = true;
    topPanel.userData.panelType = 'top';
    topPanel.userData.panelId = `${moduleState.id}_top`;
    panels.push(topPanel);
  }
  
  // 하판 (해당 역할이 true일 때만 추가)
  if (moduleState.panels && moduleState.panels.hasBottom) {
    const bottomPanel = new THREE.Mesh(
      new THREE.BoxGeometry(horizontalPanelWidth, thickness, depth),
      material
    );
    // 좌/우측 패널 사이에 위치하도록 조정
    bottomPanel.position.set(0, thickness / 2, 0);
    bottomPanel.userData.isModulePart = true;
    bottomPanel.userData.panelType = 'bottom';
    bottomPanel.userData.panelId = `${moduleState.id}_bottom`;
    panels.push(bottomPanel);
  }
  
  // 뒷판 (해당 역할이 true일 때만 추가)
  if (moduleState.panels && moduleState.panels.hasBack) {
    // 백패널 전용 두께 (9mm로 설정)
    const backPanelThickness = 9;
    // 뒷판 높이 계산 (상하판 사이에 위치)
    const backPanelHeight = height - thickness * 2;
    
    const backPanel = new THREE.Mesh(
      new THREE.BoxGeometry(horizontalPanelWidth, backPanelHeight, backPanelThickness),
      material
    );
    // 위치 조정 - 상하판 사이, Z축으로는 20mm 이동
    backPanel.position.set(0, centerY, -depth / 2 + backPanelThickness / 2 + 20);
    backPanel.userData.isModulePart = true;
    backPanel.userData.panelType = 'back';
    backPanel.userData.panelId = `${moduleState.id}_back`;
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
    // 선반 너비 계산 (좌/우측 패널 사이에 맞춤)
    const shelfWidth = horizontalPanelWidth;
    // 선반 깊이 계산 (뒷판과의 거리 고려)
    const shelfDepth = depth - thickness - 20;
    
    // 사용 가능한 내부 높이 계산
    const innerHeight = height - (thickness * 2);
    const spaceBetweenShelves = innerHeight / (shelfCount + 1);
    
    // 선반 가시성 배열 확인
    const shelfVisibility = moduleState.shelves.visibility || Array(shelfCount).fill(true);
    
    for (let i = 0; i < shelfCount; i++) {
      const shelfMesh = new THREE.Mesh(
        new THREE.BoxGeometry(shelfWidth, shelfThickness, shelfDepth),
        material
      );
      
      // 선반 위치 계산 (동일한 간격으로 배치)
      const shelfY = thickness + spaceBetweenShelves * (i + 1);
      
      // 선반 z축 위치 조정 (백패널이 20mm 이동했으므로 선반도 10mm 이동)
      shelfMesh.position.set(0, shelfY, 10);
      
      shelfMesh.castShadow = true;
      shelfMesh.receiveShadow = true;
      shelfMesh.userData.isModulePart = true;  // 모듈 구성 부분임을 표시
      shelfMesh.userData.panelType = 'shelf';
      shelfMesh.userData.shelfIndex = i;
      
      // 선반 가시성 설정
      shelfMesh.visible = shelfVisibility[i] !== false;
      
      // 선반 ID 설정 (패널 색상 및 가시성 제어용)
      shelfMesh.userData.panelId = `${moduleState.id}_shelf_${i}`;
      
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