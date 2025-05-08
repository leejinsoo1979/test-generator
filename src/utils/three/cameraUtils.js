// src/utils/three/cameraUtils.js
import * as THREE from 'three';

// 카메라를 자동으로 조정하는 함수
export const adjustCameraToModules = (modules, refs) => {
  if (!modules || modules.length === 0 || !refs || !refs.controls) return;
  
  // 모든 모듈 가져오기
  const lowerModule = modules.find(m => m.type === 'lower' || m.position === 'base');
  const rightModules = modules.filter(m => m.position === 'right');
  const topModules = modules.filter(m => m.position === 'top');
  
  if (!lowerModule) return;
  
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
  
  // 중심점 계산 - 모든 모듈의 중심
  const centerX = totalWidth / 2;
  const centerY = totalHeight / 2;
  const centerZ = 0;
  
  // 가구 크기를 기반으로 적절한 거리 계산 (더 여유있게, 특히 깊이를 고려)
  const cameraDistance = Math.max(
    totalWidth * 2.5,  // 좌우 여유 공간 더 증가 (2.0에서 2.5로 변경)
    totalHeight * 2.5, // 상하 여유 공간 더 증가 (2.0에서 2.5로 변경)
    totalDepth * 4.5   // 깊이 방향으로 충분한 공간 확보 (3.5에서 4.5로 변경)
  );
  
  // 카메라 위치와 타겟 업데이트
  const cameraPosition = [centerX, centerY, cameraDistance];
  const cameraTarget = [centerX, centerY, 0];
  
  // 부드러운 카메라 이동을 위한 애니메이션
  animateCameraMove(refs, cameraPosition, cameraTarget);
  
  // 카메라 최소/최대 줌 거리 조정
  const minDistance = Math.max(totalWidth, totalHeight, totalDepth) * 0.6;
  const maxDistance = Math.max(totalWidth, totalHeight, totalDepth) * 20;
  
  refs.controls.minDistance = minDistance;
  refs.controls.maxDistance = maxDistance;
  refs.controls.update();
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
      orthographicCamera.position.set(centerX, centerY, Math.max(totalDepth * 2, 500))
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
    scene.background = new THREE.Color(0xffffff);
    
    // 윤곽선만 보이도록 모든 메시 처리
    scene.traverse(child => {
      if (child.isMesh && child.userData.isModulePart) {
        // 기존 재질 저장
        if (!child.userData.originalMaterial) {
          child.userData.originalMaterial = child.material.clone()
        }
        
        // 모든 메시를 순수한 흰색으로 변경 (완전 불투명)
        const whiteMaterial = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          opacity: 1,
          transparent: false
        });
        child.material = whiteMaterial;
        
        // 기존의 모든 윤곽선 비활성화
        if (child.userData.outline2D) child.userData.outline2D.visible = false;
        if (child.userData.outlineEdges) child.userData.outlineEdges.visible = false;
        if (child.userData.wireframe) child.userData.wireframe.visible = false;
        if (child.userData.edges) child.userData.edges.visible = false;
        if (child.userData.outlineObject) child.userData.outlineObject.visible = false;
        
        // 완전히 새로운 방식으로 윤곽선 생성
        if (!child.userData.outline2DNew) {
          // 모든 엣지 찾기
          const edgesGeometry = new THREE.EdgesGeometry(child.geometry, 0);
          
          // 검은색 선 생성 (두껍게)
          const edgesMaterial = new THREE.LineBasicMaterial({
            color: 0x000000,
            linewidth: 3,
            depthTest: false,
            transparent: false,
            opacity: 1
          });
          
          const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
          
          // 렌더링 순서 설정 (최상위)
          edges.renderOrder = 9999;
          
          // 씬에 직접 추가 (차일드로 추가하지 않음)
          scene.add(edges);
          
          // 위치와 회전, 스케일 복사
          edges.position.copy(child.position);
          edges.rotation.copy(child.rotation);
          edges.scale.copy(child.scale);
          
          // 패널 타입에 따라 색상 변경
          if (child.userData.modulePosition === 'top') {
            // 상부장 패널은 파란색 윤곽선
            edgesMaterial.color.set(0x0000ff); 
          } else if (child.userData.modulePosition === 'right') {
            // 우측장 패널은 초록색 윤곽선
            edgesMaterial.color.set(0x00aa00);
          }
          
          // 참조 저장
          child.userData.outline2DNew = edges;
        } else {
          // 기존에 생성된 새 윤곽선이 있으면 활성화
          child.userData.outline2DNew.visible = true;
          
          // 위치 업데이트
          child.userData.outline2DNew.position.copy(child.position);
          child.userData.outline2DNew.rotation.copy(child.rotation);
          child.userData.outline2DNew.scale.copy(child.scale);
        }
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
          child.material = child.userData.originalMaterial
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
        
        // 새로 추가한 outline2DNew 숨기기
        if (child.userData.outline2DNew) {
          child.userData.outline2DNew.visible = false;
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