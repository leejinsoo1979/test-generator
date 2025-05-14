import * as THREE from 'three';
import { computeModulePosition } from './moduleUtils';

// 다중 캐비닛 모듈 추가 함수
export function addMultiCabinetModule(scene, THREE, moduleState) {
  console.log('addMultiCabinetModule 호출됨:', moduleState.modules);
  
  // scene 객체 확인
  if (!scene) {
    console.error('유효한 scene 객체가 제공되지 않았습니다.');
    return;
  }
  
  // 이전 모델 제거 - filter 방식 대신 traverse 사용
  const toRemove = [];
  try {
    scene.traverse(child => {
      if (child.isMesh && child.userData.isModulePart) {
        toRemove.push(child);
      }
      if (child.isLineSegments && child.userData.isModuleOutline) {
        toRemove.push(child);
      }
    });
    
    toRemove.forEach(obj => scene.remove(obj));
  } catch (error) {
    console.error('Scene 객체 처리 중 오류 발생:', error);
    return;
  }
  
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
    
    // scene 객체 확인
    if (!scene) {
      console.error(`[renderModule] ${module.id} 렌더링을 위한 scene 객체가 없습니다.`);
      return;
    }
    
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
      try {
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
      } catch (error) {
        console.error('와이어프레임 생성 오류:', error);
        return mesh;
      }
    };
    
    // 좌측판 (해당 역할이 true일 때만 추가)
    if (module.panels && module.panels.hasLeft && !isRightModule) {
      try {
        const leftPanel = new THREE.Mesh(
          new THREE.BoxGeometry(thickness, height, depth),
          material
        );
        
        // 좌측판 위치 - 깊이 변경 시 뒷면 위치는 고정하고 앞으로만 확장되도록 함
        // z축 위치는 뒷면에서 depth/2만큼 앞으로 이동 (중앙에 위치)
        const backZ = position.z - (depth / 2); // 뒷면 위치
        const leftPanelZ = backZ + (depth / 2); // 뒷면에서 깊이의 절반만큼 앞으로 이동
        
        leftPanel.position.set(position.x + thickness / 2, position.y + height / 2, leftPanelZ);
        leftPanel.castShadow = true;
        leftPanel.receiveShadow = true;
        leftPanel.userData.isModulePart = true;
        leftPanel.userData.moduleId = module.id;
        leftPanel.userData.panelType = 'left';
        leftPanel.userData.panelId = `${module.id}_left`;
        
        // 와이어프레임 추가
        addWireframe(leftPanel);
        
        // 씬에 추가
        if (scene.add && typeof scene.add === 'function') {
          scene.add(leftPanel);
        }
      } catch (error) {
        console.error(`좌측 패널 생성 오류 (모듈 ${module.id}):`, error);
      }
    }
    
    // 우측판 (해당 역할이 true일 때만 추가)
    if (module.panels && module.panels.hasRight) {
      try {
        const rightPanel = new THREE.Mesh(
          new THREE.BoxGeometry(thickness, height, depth),
          material
        );
        
        // 우측판 위치 - 깊이 변경 시 뒷면 위치는 고정하고 앞으로만 확장되도록 함
        // z축 위치는 뒷면에서 depth/2만큼 앞으로 이동 (중앙에 위치)
        const backZ = position.z - (depth / 2); // 뒷면 위치
        const rightPanelZ = backZ + (depth / 2); // 뒷면에서 깊이의 절반만큼 앞으로 이동
        
        rightPanel.position.set(position.x + width - thickness / 2, position.y + height / 2, rightPanelZ);
        rightPanel.castShadow = true;
        rightPanel.receiveShadow = true;
        rightPanel.userData.isModulePart = true;
        rightPanel.userData.moduleId = module.id;
        rightPanel.userData.panelType = 'right';
        rightPanel.userData.panelId = `${module.id}_right`;
        
        // 와이어프레임 추가
        addWireframe(rightPanel);
        
        // 씬에 추가
        if (scene.add && typeof scene.add === 'function') {
          scene.add(rightPanel);
        }
      } catch (error) {
        console.error(`우측 패널 생성 오류 (모듈 ${module.id}):`, error);
      }
    }
    
    // 상판 (해당 역할이 true일 때만 추가)
    if (module.panels && module.panels.hasTop !== false) {
      try {
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
        
        // 상판 Z축 위치 - 깊이 변경 시 뒷면 위치는 고정하고 앞으로만 확장되도록 함
        // z축 위치는 뒷면에서 depth/2만큼 앞으로 이동 (중앙에 위치)
        const backZ = position.z - (depth / 2); // 뒷면 위치
        const topPanelZ = backZ + (depth / 2); // 뒷면에서 깊이의 절반만큼 앞으로 이동
        
        topPanel.position.set(topPanelX, position.y + height - thickness / 2, topPanelZ);
        topPanel.castShadow = true;
        topPanel.receiveShadow = true;
        topPanel.userData.isModulePart = true;
        topPanel.userData.moduleId = module.id;
        topPanel.userData.panelType = 'top';
        topPanel.userData.panelId = `${module.id}_top`;
        
        // 와이어프레임 추가
        addWireframe(topPanel);
        
        // 씬에 추가
        if (scene.add && typeof scene.add === 'function') {
          scene.add(topPanel);
        }
      } catch (error) {
        console.error(`상판 생성 오류 (모듈 ${module.id}):`, error);
      }
    }
    
    // 하판 (해당 역할이 true일 때만 추가)
    if (module.panels && module.panels.hasBottom !== false) {
      try {
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
        
        // 하판 Z축 위치 - 깊이 변경 시 뒷면 위치는 고정하고 앞으로만 확장되도록 함
        // z축 위치는 뒷면에서 depth/2만큼 앞으로 이동 (중앙에 위치)
        const backZ = position.z - (depth / 2); // 뒷면 위치
        const bottomPanelZ = backZ + (depth / 2); // 뒷면에서 깊이의 절반만큼 앞으로 이동
        
        bottomPanel.position.set(bottomPanelX, position.y + thickness / 2, bottomPanelZ);
        bottomPanel.castShadow = true;
        bottomPanel.receiveShadow = true;
        bottomPanel.userData.isModulePart = true;
        bottomPanel.userData.moduleId = module.id;
        bottomPanel.userData.panelType = 'bottom';
        bottomPanel.userData.panelId = `${module.id}_bottom`;
        
        // 와이어프레임 추가
        addWireframe(bottomPanel);
        
        // 씬에 추가
        if (scene.add && typeof scene.add === 'function') {
          scene.add(bottomPanel);
        }
      } catch (error) {
        console.error(`하판 생성 오류 (모듈 ${module.id}):`, error);
      }
    }
    
    // 뒷판 (해당 역할이 true일 때만 추가)
    if (module.panels && module.panels.hasBack !== false) {
      try {
        // 백패널 가시성 상태 확인
        let isBackVisible = true;
        
        // 두 가지 방식의 가시성 설정 지원 (하위 호환성)
        if (module.panels.isBackVisible !== undefined) {
          isBackVisible = module.panels.isBackVisible;
        } else if (module.panels.visibility && module.panels.visibility.back !== undefined) {
          isBackVisible = module.panels.visibility.back;
        }
        
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
        
        // 백패널 크기를 정확히 계산
        const backPanelGeometry = new THREE.BoxGeometry(
          backPanelWidth, 
          backPanelHeight, 
          backPanelThickness
        );
        
        // 이전에 생성된 백패널이 있다면 완전히 제거
        if (scene && typeof scene.traverse === 'function') {
          const toRemove = [];
          scene.traverse(obj => {
            if (obj.userData && obj.userData.moduleId === module.id && obj.userData.panelType === 'back') {
              toRemove.push(obj);
            }
          });
          
          toRemove.forEach(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
              if (Array.isArray(obj.material)) {
                obj.material.forEach(mat => mat.dispose());
              } else {
                obj.material.dispose();
              }
            }
            if (scene.remove && typeof scene.remove === 'function') {
              scene.remove(obj);
            }
          });
        }
        
        // 새 백패널 생성
        const backPanel = new THREE.Mesh(
          backPanelGeometry,
          material
        );
        
        // 백패널은 뒷면에 고정 위치 - 깊이가 변경되더라도 항상 같은 위치 유지
        // z축 위치는 모듈 뒷면 (z 좌표가 가장 작은 지점)에서 backPanelThickness/2만큼 앞으로 이동
        const backPanelZ = position.z - (depth / 2) + (backPanelThickness / 2);
        
        backPanel.position.set(
          backPanelX, 
          position.y + thickness + backPanelHeight / 2, 
          backPanelZ
        );
        
        // 디버깅 로그 - 위치 계산 과정 확인
        console.log(`백패널 위치 계산 (모듈 ${module.id}):`, {
          모듈Z: position.z,
          모듈깊이: depth,
          뒷면위치: position.z - (depth / 2),
          백패널두께: backPanelThickness,
          최종위치: backPanelZ
        });
        
        backPanel.userData.moduleId = module.id;
        backPanel.userData.panelType = 'back';
        backPanel.userData.panelId = `${module.id}_back`;
        
        // 가시성 설정
        backPanel.visible = isBackVisible;
        
        // 와이어프레임 추가
        addWireframe(backPanel);
        
        // 씬에 추가
        if (scene.add && typeof scene.add === 'function') {
          scene.add(backPanel);
        }
      } catch (error) {
        console.error(`뒷판 생성 오류 (모듈 ${module.id}):`, error);
      }
    }
    
    // 선반 추가
    const shelfCount = module.shelves ? module.shelves.count : 0;
    if (shelfCount > 0) {
      try {
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
        
        // 선반 깊이 계산 - 백패널과 앞쪽에서 20mm 들어가게 설정
        const backPanelThickness = 9; // 백패널 두께
        const frontMargin = 20; // 앞쪽에서 20mm 들어가게 설정
        const shelfDepth = depth - backPanelThickness - frontMargin; // 모듈 깊이에서 백패널 두께와 앞쪽 여백을 뺌
        
        // 선반의 Z축 위치 계산 - 뒷면 기준으로 조정
        const backZ = position.z - (depth / 2); // 뒷면 위치
        // 선반은 백패널 바로 앞에 위치하고, 앞쪽에서 들어간 만큼 Z축 위치 조정
        const shelfZ = backZ + backPanelThickness + (shelfDepth / 2);
        
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
          try {
            // 선반 지오메트리 새로 생성
            const shelfGeometry = new THREE.BoxGeometry(shelfWidth, shelfThickness, shelfDepth);
            
            const shelfMesh = new THREE.Mesh(
              shelfGeometry,
              material
            );
            
            // 선반 위치 계산 (동일한 간격으로 배치)
            const shelfY = position.y + thickness + spaceBetweenShelves * (i + 1);
            
            shelfMesh.position.set(
              shelfX, 
              shelfY, 
              shelfZ
            );
            
            // 선반 위치 디버깅 로그
            console.log(`선반 위치 계산 (모듈 ${module.id}, 선반 ${i}):`, {
              x: shelfX,
              y: shelfY,
              z: shelfZ,
              뒷면위치: backZ,
              선반깊이: shelfDepth,
              뒤쪽간격: backPanelThickness,
              앞쪽간격: frontMargin
            });
            
            shelfMesh.castShadow = true;
            shelfMesh.receiveShadow = true;
            shelfMesh.userData.isModulePart = true;
            shelfMesh.userData.moduleId = module.id;
            shelfMesh.userData.panelType = 'shelf';
            shelfMesh.userData.shelfIndex = i;
            
            // 선반 가시성 설정
            shelfMesh.visible = shelfVisibility[i] !== false;
            
            // 선반 ID 설정 (패널 색상 및 가시성 제어용)
            shelfMesh.userData.panelId = `${module.id}_shelf_${i}`;
            
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
            
            // 씬에 추가
            if (scene.add && typeof scene.add === 'function') {
              scene.add(shelfMesh);
            }
          } catch (error) {
            console.error(`선반 ${i} 생성 오류 (모듈 ${module.id}):`, error);
          }
        }
      } catch (error) {
        console.error(`선반 생성 오류 (모듈 ${module.id}):`, error);
      }
    }
  };
  
  // 모든 모듈 렌더링
  allModules.forEach(module => {
    try {
      if (!module || !module.id) {
        console.error('잘못된 모듈 데이터:', module);
        return;
      }
      
      const moduleInfo = computeModulePosition(module, allModules);
      if (!moduleInfo) {
        console.error(`모듈 ${module.id}의 위치 계산 실패`);
        return;
      }
      
      renderModule(module, moduleInfo);
    } catch (error) {
      console.error(`모듈 ${module?.id || 'unknown'} 렌더링 중 오류:`, error);
    }
  });
  
  // 모듈 간 연결 - 우측장과 하부장이 붙는 부분 처리
  try {
    // 하부장 찾기
    const lowerModuleBase = allModules.find(m => m.type === 'lower' && m.position !== 'right');
    // 우측장 찾기
    const rightModuleBase = allModules.find(m => m.position === 'right');
    
    // 하부장과 우측장이 모두 존재하면 위치 재조정
    if (lowerModuleBase && rightModuleBase && scene && typeof scene.traverse === 'function') {
      // 하부장과 우측장의 위치 정보 계산
      const lowerModuleInfo = computeModulePosition(lowerModuleBase, allModules);
      const rightModuleInfo = computeModulePosition(rightModuleBase, allModules);
      
      if (!lowerModuleInfo || !rightModuleInfo) {
        console.warn('모듈 위치 정보 계산 실패');
        return;
      }
      
      // 하부장의 우측 끝 좌표 (우측 끝)
      const lowerRightEdge = lowerModuleInfo.position.x + lowerModuleInfo.dimensions.width;
      
      // 씬에서 우측장 관련 객체 찾기
      scene.traverse(object => {
        if (object && object.isMesh && object.userData && object.userData.moduleId === rightModuleBase.id) {
          // 우측장 객체의 X 좌표 조정
          // 현재 위치에서 필요한 이동량 계산
          const xOffset = lowerRightEdge - rightModuleInfo.position.x;
          
          // X축 좌표 조정
          object.position.x += xOffset;
        }
      });
      
      console.log('우측장과 하부장의 위치가 연결되도록 조정되었습니다.');
    }
  } catch (error) {
    console.error('모듈 연결 처리 중 오류:', error);
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
    // 백패널 가시성 상태 확인
    let isBackVisible = true;
    
    // 두 가지 방식의 가시성 설정 지원 (하위 호환성)
    if (moduleState.panels.isBackVisible !== undefined) {
      isBackVisible = moduleState.panels.isBackVisible;
    } else if (moduleState.panels.visibility && moduleState.panels.visibility.back !== undefined) {
      isBackVisible = moduleState.panels.visibility.back;
    }
    
    // 백패널 전용 두께 (9mm로 설정)
    const backPanelThickness = 9;
    // 뒷판 높이 계산 (상하판 사이에 위치)
    const backPanelHeight = height - thickness * 2;
    
    const backPanel = new THREE.Mesh(
      new THREE.BoxGeometry(horizontalPanelWidth, backPanelHeight, backPanelThickness),
      material
    );
    // 위치 조정 - 상하판 사이, 뒷면에 맞춤
    backPanel.position.set(0, centerY, -depth / 2 + backPanelThickness / 2);
    backPanel.userData.isModulePart = true;
    backPanel.userData.panelType = 'back';
    backPanel.userData.panelId = `${moduleState.id}_back`;
    // 가시성 설정
    backPanel.visible = isBackVisible;
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
    // 선반 너비 계산 (좌우 패널 사이에 맞춤)
    const shelfWidth = horizontalPanelWidth;
    
    // 선반 깊이 계산 - 백패널과 앞쪽에서 20mm 들어가게 설정
    const backPanelThickness = 9; // 백패널 두께
    const frontMargin = 20; // 앞쪽에서 20mm 들어가게 설정
    const shelfDepth = depth - backPanelThickness - frontMargin; // 모듈 깊이에서 백패널 두께와 앞쪽 여백을 뺌
    
    // 선반의 Z축 위치 계산 - 뒷면 기준으로 조정
    const backZ = -depth / 2; // 뒷면 위치
    // 선반은 백패널 바로 앞에 위치하고, 앞쪽에서 들어간 만큼 Z축 위치 조정
    const shelfZ = backZ + backPanelThickness + (shelfDepth / 2);
    
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
      
      shelfMesh.position.set(
        0, // 중앙에 위치
        shelfY, 
        shelfZ
      );
      
      // 선반 위치 디버깅 로그
      console.log(`선반 위치 계산 (단일 모듈, 선반 ${i}):`, {
        x: 0,
        y: shelfY,
        z: shelfZ,
        뒷면위치: backZ,
        선반깊이: shelfDepth,
        뒤쪽간격: backPanelThickness,
        앞쪽간격: frontMargin
      });
      
      shelfMesh.castShadow = true;
      shelfMesh.receiveShadow = true;
      shelfMesh.userData.isModulePart = true;
      shelfMesh.userData.moduleId = moduleState.id;
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