// src/utils/three/moduleUtils.js
import * as THREE from 'three';

// GLB 파일에서 JSON 데이터 추출
export const extractJsonFromGltf = (gltf) => {
  console.log('GLB 모델 파싱 시작:', gltf);
  const panels = [];
  
  // 디버깅용 카운터
  let meshCount = 0;
  let namedMeshCount = 0;
  
  gltf.scene.traverse(child => {
    // 모든 객체 로깅
    console.log('찾은 객체:', child.type, child.name || '이름 없음');
    
    if (child.isMesh) {
      meshCount++;
      console.log('메시 발견:', child.name || '이름 없음');
      
      // 이름이 있는 메시만 처리
      if (child.name) {
        namedMeshCount++;
        // 위치 정보가 없으면 월드 위치 계산
        const worldPosition = new THREE.Vector3();
        child.getWorldPosition(worldPosition);
        
        // 메시에서 치수와 위치 정보 추출
        let size = { w: 0, h: 0, d: 0 };
        
        // 바운딩 박스로 치수 계산
        if (child.geometry) {
          // 원본 지오메트리 보존
          if (!child.geometry.boundingBox) {
            child.geometry.computeBoundingBox();
          }
          
          const box = child.geometry.boundingBox;
          
          // 월드 스케일 적용하여 실제 사이즈 계산
          const worldScale = new THREE.Vector3();
          child.getWorldScale(worldScale);
          
          size = {
            w: Math.round(Math.abs((box.max.x - box.min.x) * worldScale.x)),
            h: Math.round(Math.abs((box.max.y - box.min.y) * worldScale.y)),
            d: Math.round(Math.abs((box.max.z - box.min.z) * worldScale.z))
          };
          
          console.log('메시 사이즈 계산:', child.name, size);
        } else if (child.scale) {
          // 스케일로 대체
          size = {
            w: Math.round(Math.abs(child.scale.x * 100)), // 스케일을 mm 단위로 변환 가정
            h: Math.round(Math.abs(child.scale.y * 100)),
            d: Math.round(Math.abs(child.scale.z * 100))
          };
          console.log('스케일 기반 사이즈:', child.name, size);
        }
        
        // 패널 정보 저장
        panels.push({
          name: child.name,
          position: {
            x: Math.round(worldPosition.x),
            y: Math.round(worldPosition.y),
            z: Math.round(worldPosition.z)
          },
          size: size
        });
      }
    }
  });
  
  console.log(`처리 결과: 총 ${meshCount}개 메시 중 ${namedMeshCount}개 처리됨`);
  console.log('추출된 패널 데이터:', panels);
  
  return { panels };
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