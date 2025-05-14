// src/utils/three/cameraUtils.js
import * as THREE from 'three';
import { MeshLineGeometry, MeshLineMaterial, raycast } from 'meshline';

// 카메라를 자동으로 조정하는 함수
export const adjustCameraToModules = (modules, refs) => {
  if (!modules || modules.length === 0 || !refs || !refs.controls) {
    console.warn('adjustCameraToModules: 모듈 또는 필수 참조가 없음', { modules, refs: refs ? Object.keys(refs) : null });
    return;
  }
  
  console.log('카메라 조정 시작:', { 모듈수: modules.length, 카메라타입: refs.camera ? refs.camera.type : '없음' });
  
  // 모든 모듈 가져오기
  const lowerModule = modules.find(m => m.type === 'lower' || m.position === 'base');
  const rightModules = modules.filter(m => m.position === 'right');
  const topModules = modules.filter(m => m.position === 'top');
  
  if (!lowerModule) {
    console.warn('adjustCameraToModules: 기준 하부 모듈이 없음');
    return;
  }
  
  // 최대 영역 계산 (모든 모듈의 위치와 크기 고려)
  let minX = 0, maxX = 0;
  let minY = 0, maxY = 0;
  let minZ = 0, maxZ = 0;
  
  // 하부장 영역
  maxX = Math.max(maxX, lowerModule.dimensions.width);
  maxY = Math.max(maxY, lowerModule.dimensions.height);
  maxZ = Math.max(maxZ, lowerModule.dimensions.depth);
  
  // 우측장 영역
  if (rightModules.length > 0) {
    maxX = Math.max(maxX, lowerModule.dimensions.width + 
      rightModules.reduce((sum, m) => sum + m.dimensions.width, 0));
    maxY = Math.max(maxY, rightModules.reduce((max, m) => 
      Math.max(max, m.dimensions.height), 0));
  }
  
  // 상부장 영역
  if (topModules.length > 0) {
    // 너비는 상부장 중 가장 넓은 것 또는 기존 너비 중 큰 것 선택
    maxX = Math.max(maxX, lowerModule.dimensions.width + 
      rightModules.reduce((sum, m) => sum + m.dimensions.width, 0),
      topModules.reduce((max, m) => Math.max(max, m.dimensions.width), 0));
    
    // 높이는 하부장 높이 + 모든 상부장 높이의 합
    // 중요: 기존 로직 Math.max 대신 직접 합산으로 변경
    maxY = lowerModule.dimensions.height + 
      topModules.reduce((sum, m) => sum + m.dimensions.height, 0);
  }
  
  // 총 영역 크기
  const totalWidth = maxX - minX;
  const totalHeight = maxY - minY;
  const totalDepth = maxZ - minZ;
  
  console.log('모듈 총 영역:', { 너비: totalWidth, 높이: totalHeight, 깊이: totalDepth });
  
  // 중심점 계산 - 모든 모듈의 중심
  const centerX = totalWidth / 2;
  const centerY = totalHeight / 2;
  const centerZ = 0;
  
  // 가구 크기를 기반으로 적절한 거리 계산 (더 여유있게, 특히 깊이를 고려)
  const cameraDistance = Math.max(
    totalWidth * 5.0,  // 좌우 여유 공간 더 증가 (3.5에서 5.0으로 변경)
    totalHeight * 5.0, // 상하 여유 공간 더 증가 (3.5에서 5.0으로 변경)
    totalDepth * 8.0   // 깊이 방향으로 충분한 공간 확보 (6.0에서 8.0으로 변경)
  );
  
  // 카메라 위치와 타겟 업데이트
  const cameraPosition = [centerX, centerY, cameraDistance];
  const cameraTarget = [centerX, centerY, 0];
  
  console.log('카메라 위치 및 타겟 설정:', { 위치: cameraPosition, 타겟: cameraTarget });
  
  // 부드러운 카메라 이동을 위한 애니메이션
  animateCameraMove(refs, cameraPosition, cameraTarget);
  
  // 카메라 최소/최대 줌 거리 조정
  const minDistance = Math.max(totalWidth, totalHeight, totalDepth) * 0.6;
  const maxDistance = Math.max(totalWidth, totalHeight, totalDepth) * 20;
  
  refs.controls.minDistance = minDistance;
  refs.controls.maxDistance = maxDistance;
  refs.controls.update();
  
  // 초기 카메라 위치 업데이트 (카메라 초기화 시 사용)
  if (refs.initialCameraPosition && refs.initialCameraTarget) {
    refs.initialCameraPosition = [...cameraPosition];
    refs.initialCameraTarget = [...cameraTarget];
    console.log('초기 카메라 위치 업데이트됨');
  }
  
  return { cameraPosition, cameraTarget, centerX, centerY, totalWidth, totalHeight, totalDepth };
};

// 카메라 이동 애니메이션 (GSAP 없이 구현)
const animateCameraMove = (refs, targetPosition, targetLookAt) => {
  // 현재 카메라 (원근 또는 직교 카메라)
  const camera = refs.camera;
  const controls = refs.controls;
  
  if (!camera || !controls) return;
  
  // 애니메이션 시작 값
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  
  // 애니메이션 설정
  const duration = 800; // 800ms (0.8초) 동안 애니메이션
  const startTime = Date.now();
  
  // 애니메이션 프레임 함수
  function animate() {
    const now = Date.now();
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // easeOutCubic 애니메이션 효과 (부드러운 감속)
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    
    // 카메라 위치 업데이트
    camera.position.x = startPos.x + (targetPosition[0] - startPos.x) * easeProgress;
    camera.position.y = startPos.y + (targetPosition[1] - startPos.y) * easeProgress;
    camera.position.z = startPos.z + (targetPosition[2] - startPos.z) * easeProgress;
    
    // 카메라 타겟 업데이트
    controls.target.x = startTarget.x + (targetLookAt[0] - startTarget.x) * easeProgress;
    controls.target.y = startTarget.y + (targetLookAt[1] - startTarget.y) * easeProgress;
    controls.target.z = startTarget.z + (targetLookAt[2] - startTarget.z) * easeProgress;
    
    // 원근 카메라와 직교 카메라 모두 업데이트
    refs.perspectiveCamera.position.copy(camera.position);
    refs.perspectiveCamera.lookAt(controls.target);
    
    refs.orthographicCamera.position.copy(camera.position);
    refs.orthographicCamera.lookAt(controls.target);
    
    // 컨트롤 업데이트
    controls.update();
    
    // 렌더러가 있으면 렌더링
    if (refs.renderer && refs.scene) {
      refs.renderer.render(refs.scene, camera);
    }
    
    // 애니메이션 계속
    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }
  
  // 애니메이션 시작
  animate();
};

// 뷰 모드에 따라 카메라 및 재질 업데이트
export const updateViewMode = (mode, refs, moduleState) => {
  const { scene, camera, renderer, perspectiveCamera, orthographicCamera } = refs
  
  // 모든 모듈의 치수를 합산하여 전체 크기 계산
  const modules = moduleState.modules || [];
  let totalWidth = 600;
  let totalHeight = 720;
  let totalDepth = 577; // 기본 값
  
  if (modules.length > 0) {
    // 모듈 치수 계산
    const lowerModule = modules.find(m => m.type === 'lower' || m.position === 'base');
    const rightModules = modules.filter(m => m.position === 'right');
    const topModules = modules.filter(m => m.position === 'top');
    
    // 계산된 총 너비 (우측 모듈을 고려)
    totalWidth = lowerModule ? lowerModule.dimensions.width : 600;
    if (rightModules.length > 0) {
      totalWidth += rightModules.reduce((sum, m) => sum + m.dimensions.width, 0);
    }
    
    // 계산된 총 높이 (상부 모듈을 고려)
    totalHeight = lowerModule ? lowerModule.dimensions.height : 720;
    if (topModules.length > 0) {
      totalHeight += topModules.reduce((sum, m) => sum + m.dimensions.height, 0);
    }
    
    // 계산된 깊이
    totalDepth = Math.max(...modules.map(m => m.dimensions.depth));
  }
  
  // 중심점 계산
  const centerX = totalWidth / 2;
  const centerY = totalHeight / 2;
  
  if (mode === '2D') {
    // 직교 카메라로 전환
    refs.camera = orthographicCamera
    
    // 2D 모드에서는 회전 잠금 및 정면에서 바라보도록 설정
    if (refs.controls) {
      refs.controls.enableRotate = false
      
      // 카메라를 정면에 고정 (정확히 가구의 중심을 바라보도록 설정)
      orthographicCamera.position.set(centerX, centerY, Math.max(totalDepth * 5, 1200))
      orthographicCamera.lookAt(centerX, centerY, 0)
      
      // 직교 카메라 크기 조정 (가구가 화면에 맞도록)
      const aspect = refs.mountRef.clientWidth / refs.mountRef.clientHeight;
      const frustumSize = Math.max(totalWidth * 1.2, totalHeight * 1.2);
      orthographicCamera.left = frustumSize * aspect / -2;
      orthographicCamera.right = frustumSize * aspect / 2;
      orthographicCamera.top = frustumSize / 2;
      orthographicCamera.bottom = frustumSize / -2;
      orthographicCamera.updateProjectionMatrix();
      
      refs.controls.target.set(centerX, centerY, 0);
      refs.controls.update()
    }
    
    // 2D 모드에서는 라이팅 효과 제거 (모든 조명 비활성화)
    scene.traverse(light => {
      if (light.isLight) {
        light.userData.originalVisible = light.visible;
        light.visible = false;
      }
    });
    
    // 배경색 변경
    scene.background = new THREE.Color(0xe8f0f8); // CAD 스타일 배경색으로 변경 (연한 청회색)
    
    // 윤곽선만 보이도록 모든 메시 처리
    scene.traverse(child => {
      if (child.isMesh && child.userData.isModulePart) {
        // 기존 재질 저장
        if (!child.userData.originalMaterial) {
          child.userData.originalMaterial = child.material.clone()
        }
        
        // 모든 메시를 투명하게 만들기 (보이지 않게)
        const invisibleMaterial = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          opacity: 0,
          transparent: true,
          visible: false
        });
        child.material = invisibleMaterial;
        
        // 기존의 모든 윤곽선 비활성화
        if (child.userData.outline2D) child.userData.outline2D.visible = false;
        if (child.userData.outlineEdges) child.userData.outlineEdges.visible = false;
        if (child.userData.wireframe) child.userData.wireframe.visible = false;
        if (child.userData.edges) child.userData.edges.visible = false;
        if (child.userData.outlineObject) child.userData.outlineObject.visible = false;
        if (child.userData.outline2DNew) {
          // 기존에 생성한 MeshLine이 있다면 제거
          if (child.userData.outline2DNew.parent) {
            scene.remove(child.userData.outline2DNew);
          }
          child.userData.outline2DNew = null;
        }
        
        // MeshLine을 사용하여 더 깔끔한 윤곽선 생성
        // 먼저 메시의 모서리를 찾아서 포인트 배열 생성
        const edgesGeometry = new THREE.EdgesGeometry(child.geometry);
        const positions = edgesGeometry.attributes.position.array;
        
        // MeshLineGeometry 생성
        const meshLineGeometry = new MeshLineGeometry();
        meshLineGeometry.setPoints(positions);
        
        // MeshLineMaterial 생성 (CAD 스타일 라인)
        const meshLineMaterial = new MeshLineMaterial({
          color: 0x000000,
          lineWidth: 0.005, // 선 두께 조절
          resolution: new THREE.Vector2(
            refs.mountRef ? refs.mountRef.clientWidth : window.innerWidth,
            refs.mountRef ? refs.mountRef.clientHeight : window.innerHeight
          ),
          sizeAttenuation: 1, // 거리에 상관없이 일정한 크기
          depthTest: false, // 항상 앞에 보이도록
        });
        
        // MeshLine 메시 생성
        const meshLine = new THREE.Mesh(meshLineGeometry, meshLineMaterial);
        meshLine.raycast = raycast; // 레이캐스트 지원 추가
        
        // 위치, 회전, 스케일 복사
        meshLine.position.copy(child.position);
        meshLine.rotation.copy(child.rotation);
        meshLine.scale.copy(child.scale);
        
        // 렌더링 순서 설정 (최상위)
        meshLine.renderOrder = 9999;
        
        // 씬에 직접 추가
        scene.add(meshLine);
        
        // 참조 저장
        child.userData.outline2DNew = meshLine;
      }
    })
  } else {
    // 원근 카메라로 전환
    refs.camera = perspectiveCamera
    
    // 3D 모드에서는 회전 허용
    if (refs.controls) {
      refs.controls.enableRotate = true
    }
    
    // 배경색 복원
    scene.background = new THREE.Color(0xf5f5f5); // 원래 배경색
    
    // 라이팅 원래 상태로 복원
    scene.traverse(light => {
      if (light.isLight && light.userData.originalVisible !== undefined) {
        light.visible = light.userData.originalVisible;
      }
    });
    
    // 원래 재질로 복원
    scene.traverse(child => {
      if (child.isMesh && child.userData.isModulePart) {
        // 원래 재질로 복원
        if (child.userData.originalMaterial) {
          child.material = child.userData.originalMaterial;
          child.material.needsUpdate = true;
          child.visible = true; // 메시 가시성 복원
        }
        
        // 와이어프레임 숨기기
        if (child.userData.wireframe) {
          child.userData.wireframe.visible = false;
        }
        
        // 윤곽선 객체 숨기기
        if (child.userData.outlineObject) {
          child.userData.outlineObject.visible = false;
        }
        
        // 윤곽선 엣지 숨기기
        if (child.userData.outlineEdges) {
          child.userData.outlineEdges.visible = false;
        }
        
        // addCabinetModule에서 추가한 outline2D 숨기기
        if (child.userData.outline2D) {
          child.userData.outline2D.visible = false;
        }
        
        // MeshLine 객체 제거
        if (child.userData.outline2DNew) {
          if (child.userData.outline2DNew.parent) {
            scene.remove(child.userData.outline2DNew);
          }
          child.userData.outline2DNew = null;
        }
        
        // 엣지(윤곽선) 숨기기
        if (child.userData.edges) {
          child.userData.edges.visible = false
        }
      }
    })
  }
  
  // 컨트롤 업데이트
  if (refs.controls) {
    refs.controls.object = refs.camera
    refs.controls.update()
  }
  
  // 모드 변경 후 카메라 자동 조정
  adjustCameraToModules(moduleState.modules, refs);
} 