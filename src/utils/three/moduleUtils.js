// src/utils/three/moduleUtils.js
import * as THREE from 'three';

// GLB 파일에서 JSON 데이터 추출
export const extractJsonFromGltf = (gltf) => {
  try {
    // 씬에서 메타데이터 찾기
    if (gltf.scene && gltf.scene.userData && gltf.scene.userData.moduleData) {
      // 저장된 모듈 데이터 검색 및 파싱
      try {
        const moduleData = JSON.parse(gltf.scene.userData.moduleData);
        console.log('GLB 파일에서 모듈 데이터 추출 성공:', moduleData);
        return moduleData;
      } catch (e) {
        console.warn('GLB 파일의The JSON 데이터 파싱 오류:', e);
      }
    }
    
    // 메타데이터가 없는 경우 패널을 기반으로 모듈 데이터 구성 시도
    console.log('GLB에서 메타데이터를 찾을 수 없어 메시를 분석합니다.');
    const panels = [];
    
    // 모든 객체 탐색
    gltf.scene.traverse((object) => {
      if (object.isMesh) {
        // 메시의 경계 상자 계산
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const position = box.getCenter(new THREE.Vector3());
        
        // 패널 정보 저장
        panels.push({
          name: object.name || `panel_${panels.length}`,
          position: {
            x: position.x,
            y: position.y,
            z: position.z
          },
          size: {
            w: size.x,
            h: size.y,
            d: size.z
          }
        });
      }
    });
    
    // 패널 정보 반환
    return { panels };
  } catch (error) {
    console.error('GLB 데이터 추출 오류:', error);
    return { panels: [] };
  }
};

// 모듈 데이터를 추출하고 해석하는 향상된 함수
export const parseModuleDataFromGLB = (gltf) => {
  // 먼저 JSON 데이터 추출 시도
  const extractedData = extractJsonFromGltf(gltf);
  
  // 모듈 데이터가 있는 경우 직접 사용
  if (extractedData.modules && extractedData.modules.length > 0) {
    console.log('GLB에서 완전한 모듈 데이터를 추출했습니다:', extractedData);
    return extractedData;
  }
  
  // 패널 정보만 있는 경우, 모듈 구조로 변환
  if (extractedData.panels && extractedData.panels.length > 0) {
    // 전체 구조물의 크기 계산
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    extractedData.panels.forEach(panel => {
      const { position, size } = panel;
      
      // 패널의 최소/최대 좌표 계산
      const x1 = position.x - size.w / 2;
      const x2 = position.x + size.w / 2;
      const y1 = position.y - size.h / 2;
      const y2 = position.y + size.h / 2;
      const z1 = position.z - size.d / 2;
      const z2 = position.z + size.d / 2;
      
      // 전체 범위 업데이트
      minX = Math.min(minX, x1, x2);
      maxX = Math.max(maxX, x1, x2);
      minY = Math.min(minY, y1, y2);
      maxY = Math.max(maxY, y1, y2);
      minZ = Math.min(minZ, z1, z2);
      maxZ = Math.max(maxZ, z1, z2);
    });
    
    // 전체 크기 계산
    const width = Math.round(maxX - minX);
    const height = Math.round(maxY - minY);
    const depth = Math.round(maxZ - minZ);
    
    // 패널 두께 추정 (가장 얇은 패널 기준)
    let thickness = Infinity;
    extractedData.panels.forEach(panel => {
      const { size } = panel;
      thickness = Math.min(thickness, size.w, size.h, size.d);
    });
    
    // 너무 얇으면 기본값 사용
    if (thickness < 10) thickness = 18;
    
    // 선반 개수 추정
    const shelvesCount = extractedData.panels.filter(p => 
      p.name.toLowerCase().includes('shelf') || 
      (p.size.h < thickness * 1.5 && 
       p.size.w > thickness * 2 && 
       p.size.d > thickness * 2)
    ).length;
    
    // 모듈 상태 구성
    const lowerModule = {
      id: `lower_${Date.now()}`,
      type: 'lower',
      position: 'base',
      dimensions: {
        width,
        height,
        depth
      },
      panelThickness: thickness,
      panels: {
        hasLeft: extractedData.panels.some(p => p.name.toLowerCase().includes('left')),
        hasRight: extractedData.panels.some(p => p.name.toLowerCase().includes('right')),
        hasTop: extractedData.panels.some(p => p.name.toLowerCase().includes('top')),
        hasBottom: extractedData.panels.some(p => p.name.toLowerCase().includes('bottom')),
        hasBack: extractedData.panels.some(p => p.name.toLowerCase().includes('back'))
      },
      material: 'melamine_white',
      shelves: {
        count: shelvesCount,
        distribution: 'equal',
        positions: []
      }
    };
    
    const moduleData = {
      name: 'GLB에서 가져온 가구',
      modules: [lowerModule]
    };
    
    console.log('패널 데이터에서 모듈 구조를 생성했습니다:', moduleData);
    return moduleData;
  }
  
  // 데이터가 없는 경우 빈 구조 반환
  return {
    name: 'GLB에서 가져온 가구',
    modules: []
  };
};

// 모듈 위치 계산 함수 (하부장 → 우측장 → 상부장 기준)
export function computeModulePosition(module, allModules) {
  const panelThickness = module.panelThickness || 18;

  const lowerModule = allModules.find(m => m.type === 'lower' || m.position === 'base');
  const rightModules = allModules.filter(m => m.position === 'right');
  const topModules = allModules.filter(m => m.position === 'top');

  // 기본값
  let position = { x: 0, y: 0, z: 0 };
  let dimensions = { ...module.dimensions };

  // 하부장
  if (module.type === 'lower' && module.position !== 'right') {
    return { position, dimensions };
  }

  // 우측장
  if (module.position === 'right') {
    position.x = lowerModule.dimensions.width;
    position.y = 0;
    position.z = 0;
    
    // 생성 순서를 확인 (우측장이 상부장보다 먼저 생성된 경우)
    const isRightBeforeTop = 
      topModules.length > 0 && 
      module.createTimestamp && 
      topModules[0].createTimestamp && 
      module.createTimestamp < topModules[0].createTimestamp;
    
    // 우측장 높이 계산
    if (isRightBeforeTop || topModules.length === 0) {
      // 하부장 > 우측장 > 상부장 시나리오: 우측장 높이는 하부장과 동일
      dimensions.height = lowerModule.dimensions.height;
    } else {
      // 하부장 > 상부장 > 우측장 시나리오: 우측장 높이는 하부장 + 상부장 합계
      const totalHeight = lowerModule.dimensions.height + 
        topModules.reduce((sum, m) => sum + m.dimensions.height, 0);
      dimensions.height = totalHeight;
    }
    
    return { position, dimensions };
  }

  // 상부장
  if (module.position === 'top') {
    position.x = 0;
    position.y = lowerModule.dimensions.height;
    position.z = 0;
    
    // 생성 순서를 확인 (상부장이 우측장보다 먼저 생성된 경우)
    const isTopBeforeRight = 
      rightModules.length > 0 && 
      module.createTimestamp && 
      rightModules[0].createTimestamp && 
      module.createTimestamp < rightModules[0].createTimestamp;
    
    // 상부장 너비 계산: 하부장 > 상부장 > 우측장 시나리오인 경우
    if (isTopBeforeRight) {
      // 하부장 > 상부장 > 우측장: 상부장 너비는 하부장만큼만
      dimensions.width = lowerModule.dimensions.width;
    } else if (rightModules.length > 0) {
      // 하부장 > 우측장 > 상부장: 상부장 너비는 하부장+우측장 합산
      const totalWidth = lowerModule.dimensions.width + 
        rightModules.reduce((sum, m) => sum + m.dimensions.width, 0);
      dimensions.width = totalWidth;
    } else {
      // 우측장이 없는 경우: 상부장 너비는 하부장과 동일
      dimensions.width = lowerModule.dimensions.width;
    }
    
    return { position, dimensions };
  }

  return { position, dimensions };
} 