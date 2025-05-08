import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

// 카메라를 자동으로 조정하는 함수
const adjustCameraToModules = (modules, refs) => {
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
    maxX = Math.max(maxX, topModules.reduce((max, m) => 
      Math.max(max, m.dimensions.width), 0));
    maxY = Math.max(maxY, lowerModule.dimensions.height + 
      topModules.reduce((sum, m) => sum + m.dimensions.height, 0));
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
    totalWidth * 1.3,
    totalHeight * 1.3,
    totalDepth * 2.5
  );
  
  // 카메라 위치와 타겟 업데이트
  const cameraPosition = [centerX, centerY, cameraDistance];
  const cameraTarget = [centerX, centerY, 0];
  
  // 원근 카메라 업데이트
  refs.perspectiveCamera.position.set(...cameraPosition);
  refs.perspectiveCamera.lookAt(...cameraTarget);
  
  // 직교 카메라 업데이트
  refs.orthographicCamera.position.set(...cameraPosition);
  refs.orthographicCamera.lookAt(...cameraTarget);
  
  // 컨트롤 타겟 업데이트
  refs.controls.target.set(centerX, centerY, 0);
  
  // 카메라 최소/최대 줌 거리 조정
  const minDistance = Math.max(totalWidth, totalHeight, totalDepth) * 0.6;
  const maxDistance = Math.max(totalWidth, totalHeight, totalDepth) * 20;
  
  refs.controls.minDistance = minDistance;
  refs.controls.maxDistance = maxDistance;
  refs.controls.update();
  
  // 활성 카메라가 적용되도록 렌더러 업데이트
  if (refs.renderer && refs.scene && refs.camera) {
    refs.renderer.render(refs.scene, refs.camera);
  }
}

const ThreeViewer = ({ moduleState, setModuleState }) => {
  const mountRef = useRef(null)
  const threeRef = useRef({})
  const [viewMode, setViewMode] = useState('3D') // 기본값은 3D 모드
  const [glbData, setGlbData] = useState(null) // GLB 파일 데이터
  const [showAddModal, setShowAddModal] = useState(false) // 모듈 추가 모달 표시 여부
  const [selectedModuleId, setSelectedModuleId] = useState(null) // 선택된 모듈 ID
  const prevModuleStateRef = useRef(null) // 이전 모듈 상태 참조

  // 모듈 초기화 - 컴포넌트 마운트 시 기본 모듈이 없으면 생성
  useEffect(() => {
    // 모듈이 없을 경우 기본 하부장 생성
    if (!moduleState.modules || moduleState.modules.length === 0) {
      initializeDefaultModule();
    }
  }, []);

  // 기본 하부장 모듈 초기화
  const initializeDefaultModule = () => {
    const defaultModule = {
      id: `base_${Date.now()}`,
      type: 'lower',
      position: 'base',
      dimensions: {
        width: 600,
        height: 700,
        depth: 550
      },
      panelThickness: 18,
      panels: {
        hasLeft: true,
        hasRight: true,
        hasTop: true,
        hasBottom: true,
        hasBack: true
      },
      material: 'melamine_white',
      shelves: {
        count: 1,
        distribution: 'equal',
        positions: []
      }
    };

    // 모듈 상태 업데이트
    const newModuleState = {
      ...moduleState,
      modules: [defaultModule]
    };
    
    setModuleState(newModuleState);
    console.log('기본 하부장 모듈이 초기화되었습니다.', defaultModule);
  };

  // 2D/3D 모드 토글 핸들러
  const toggleViewMode = () => {
    const newMode = viewMode === '3D' ? '2D' : '3D'
    setViewMode(newMode)
    
    // 카메라와 재질 업데이트
    if (threeRef.current.camera && threeRef.current.scene) {
      updateViewMode(newMode, threeRef.current)
    }
  }

  // GLB 파일 처리 함수
  const handleGlbUpload = (event) => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const arrayBuffer = e.target.result
      
      // GLTFLoader로 GLB 파일 파싱
      const loader = new GLTFLoader()
      loader.parse(arrayBuffer, '', (gltf) => {
        console.log('GLB 파일 로드 성공:', gltf)
        
        // 씬 초기화
        if (threeRef.current.scene) {
          // 기존 메시 제거
          const scene = threeRef.current.scene
          const toRemove = []
          scene.traverse(child => {
            if (child.isMesh && child.userData.isModulePart) {
              toRemove.push(child)
            }
          })
          toRemove.forEach(obj => scene.remove(obj))
          
          // gltf 모델 씬에 추가
          scene.add(gltf.scene)
          
          // JSON 데이터 추출
          const jsonData = extractJsonFromGltf(gltf)
          setGlbData(jsonData)
          
          // 뷰어 업데이트
          threeRef.current.renderer.render(scene, threeRef.current.camera)
        }
      }, (error) => {
        console.error('GLB 파일 로드 실패:', error)
      })
    }
    reader.readAsArrayBuffer(file)
  }
  
  // GLB에서 JSON 데이터 추출
  const extractJsonFromGltf = (gltf) => {
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
  }
  
  // JSON 데이터를 모듈 상태로 변환
  const convertGlbToModule = () => {
    if (!glbData) return;
    
    console.log('GLB 데이터를 모듈 상태로 변환 시작:', glbData);
    
    try {
      // 패널 정보 추출
      const { panels } = glbData;
      
      if (!panels || panels.length === 0) {
        console.error('변환할 패널 정보가 없습니다.');
        return;
      }
      
      // 전체 구조물의 크기 계산
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      
      panels.forEach(panel => {
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
      panels.forEach(panel => {
        const { size } = panel;
        thickness = Math.min(thickness, size.w, size.h, size.d);
      });
      
      // 너무 얇으면 기본값 사용
      if (thickness < 10) thickness = 18;
      
      // 새 모듈 상태 생성 (새로운 구조 사용)
      const lowerModule = {
        id: 'lower',
        type: 'lower',
        dimensions: {
          width,
          height,
          depth
        },
        panelThickness: thickness,
        panels: {
          hasLeft: panels.some(p => p.name.toLowerCase().includes('left')),
          hasRight: panels.some(p => p.name.toLowerCase().includes('right')),
          hasTop: panels.some(p => p.name.toLowerCase().includes('top')),
          hasBottom: panels.some(p => p.name.toLowerCase().includes('bottom')),
          hasBack: panels.some(p => p.name.toLowerCase().includes('back'))
        },
        material: 'melamine_white',
        shelves: {
          count: panels.filter(p => 
            p.name.toLowerCase().includes('shelf') || 
            (p.size.h < thickness * 1.5 && 
             p.size.w > thickness * 2 && 
             p.size.d > thickness * 2)
          ).length,
          distribution: 'equal',
          positions: []
        }
      };
      
      const newModuleState = {
        ...moduleState,
        modules: [lowerModule]
      };
      
      console.log('변환된 모듈 상태:', newModuleState);
      
      // 상태 업데이트
      setModuleState(newModuleState);
      
      // 씬 재생성
      if (threeRef.current.scene) {
        // 이전 모델 제거
        const scene = threeRef.current.scene;
        const toRemove = [];
        scene.traverse(child => {
          if (child.isMesh && child.userData.isModulePart) {
            toRemove.push(child);
          }
        });
        toRemove.forEach(obj => scene.remove(obj));
        
        // 새 모듈 추가
        addMultiCabinetModule(scene, THREE, newModuleState);
        
        // 렌더링 업데이트
        threeRef.current.renderer.render(scene, threeRef.current.camera);
      }
      
      alert('GLB 데이터를 성공적으로 변환했습니다.');
    } catch (error) {
      console.error('GLB 데이터 변환 중 오류 발생:', error);
      alert('변환 중 오류가 발생했습니다: ' + error.message);
    }
  }

  // 뷰 모드에 따라 카메라 및 재질 업데이트
  const updateViewMode = (mode, refs) => {
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
        const aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
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

  // 모듈 선택 핸들러
  const handleModuleSelect = (moduleId) => {
    setSelectedModuleId(moduleId);
    console.log('모듈 선택됨:', moduleId);
  }

  // 선반 추가 함수
  const addShelf = (moduleId) => {
    const newModuleState = { ...moduleState };
    const modules = [...newModuleState.modules];
    
    // 선택한 모듈 찾기
    const moduleIndex = modules.findIndex(m => m.id === moduleId);
    if (moduleIndex === -1) return;
    
    const module = modules[moduleIndex];
    
    // 선반 수 증가
    if (!module.shelves) {
      module.shelves = { count: 0, distribution: 'equal', positions: [] };
    }
    
    module.shelves.count = (module.shelves.count || 0) + 1;
    
    // 모듈 상태 업데이트
    newModuleState.modules = modules;
    setModuleState(newModuleState);
    
    // 즉시 씬 업데이트 (2D/3D 토글 없이 바로 변경 반영)
    setTimeout(() => {
      if (threeRef.current.scene) {
        // 씬 제거 및 다시 그리기
        addMultiCabinetModule(threeRef.current.scene, THREE, newModuleState);
        threeRef.current.renderer.render(threeRef.current.scene, threeRef.current.camera);
      }
    }, 0);
    
    console.log(`모듈 ${moduleId}에 선반 추가됨:`, module.shelves.count);
  }

  // 선반 제거 함수
  const removeShelf = (moduleId) => {
    const newModuleState = { ...moduleState };
    const modules = [...newModuleState.modules];
    
    // 선택한 모듈 찾기
    const moduleIndex = modules.findIndex(m => m.id === moduleId);
    if (moduleIndex === -1) return;
    
    const module = modules[moduleIndex];
    
    // 선반이 있는 경우에만 제거
    if (module.shelves && module.shelves.count > 0) {
      module.shelves.count -= 1;
      
      // 모듈 상태 업데이트
      newModuleState.modules = modules;
      setModuleState(newModuleState);
      
      // 즉시 씬 업데이트 (2D/3D 토글 없이 바로 변경 반영)
      setTimeout(() => {
        if (threeRef.current.scene) {
          // 씬 제거 및 다시 그리기
          addMultiCabinetModule(threeRef.current.scene, THREE, newModuleState);
          threeRef.current.renderer.render(threeRef.current.scene, threeRef.current.camera);
        }
      }, 0);
      
      console.log(`모듈 ${moduleId}에서 선반 제거됨:`, module.shelves.count);
    }
  }

  // 모듈 추가 모달 열기 핸들러
  const openAddModuleModal = () => {
    setShowAddModal(true);
  }

  // 모듈 추가 모달 닫기 핸들러
  const closeAddModuleModal = () => {
    setShowAddModal(false);
  }

  // 모듈 추가 핸들러 (위 또는 오른쪽에 추가)
  const addModule = (position) => {
    // 기존 모듈 상태 복사
    const newModuleState = { ...moduleState };
    const modules = [...(newModuleState.modules || [])];
    
    // 하부장 모듈 찾기
    const lowerModule = modules.find(m => m.type === 'lower' || m.position === 'base');
    
    if (!lowerModule) {
      console.error('하부 모듈이 없습니다. 먼저 하부 모듈을 추가하세요.');
      return;
    }
    
    // 우측 모듈들 찾기
    const rightModules = modules.filter(m => m.position === 'right');
    
    // 상부 모듈들 찾기
    const topModules = modules.filter(m => m.position === 'top');
    
    // 현재 타임스탬프 생성 (모듈 생성 순서 추적용)
    const currentTimestamp = Date.now();
    
    if (position === 'top') {
      // 상부장 추가하기
      // 새 모듈 ID 생성
      const newModuleId = `top_${currentTimestamp}`;
      
      // 상부장 모듈 생성
      const newTopModule = {
        id: newModuleId,
        type: 'upper',
        position: 'top',
        dimensions: {
          width: lowerModule.dimensions.width, // 기본적으로 하부장과 동일한 너비
          height: 600, // 기본 높이
          depth: lowerModule.dimensions.depth // 깊이는 하부장과 동일
        },
        panelThickness: lowerModule.panelThickness || 18,
        panels: {
          hasLeft: true,
          hasRight: true,
          hasTop: true,
          hasBottom: true,
          hasBack: true
        },
        material: lowerModule.material || 'melamine_white',
        shelves: {
          count: 1,
          distribution: 'equal',
          positions: []
        },
        fixedDepth: true, // 깊이는 항상 하부장과 동일하므로 고정
        createTimestamp: currentTimestamp // 생성 시간 기록
      };

      // 상부장 너비 계산 - 항상 하부장 너비와 동일하게 설정
      newTopModule.dimensions.width = lowerModule.dimensions.width;
      console.log('상부장 너비가 하부장 기준으로 설정됨:', lowerModule.dimensions.width);
      
      // 너비 수정 불가 표시
      newTopModule.fixedWidth = true;
      
      // 모듈 추가
      modules.push(newTopModule);
      
      console.log('상부장 모듈 추가됨:', newTopModule);
      
    } else if (position === 'right') {
      // 우측장 추가하기
      // 새 모듈 ID 생성
      const newModuleId = `right_${currentTimestamp}`;
      
      // 우측장 모듈 생성
      const newRightModule = {
        id: newModuleId,
        type: 'lower',
        position: 'right',
        dimensions: {
          width: 400, // 기본 너비
          height: lowerModule.dimensions.height, // 기본적으로 하부장과 동일한 높이
          depth: lowerModule.dimensions.depth // 깊이는 하부장과 동일
        },
        panelThickness: lowerModule.panelThickness || 18,
        panels: {
          hasLeft: false, // 좌측 패널 없음
          hasRight: true,
          hasTop: true,
          hasBottom: true,
          hasBack: true
        },
        material: lowerModule.material || 'melamine_white',
        shelves: {
          count: 1,
          distribution: 'equal',
          positions: []
        },
        fixedDepth: true, // 깊이는 항상 하부장과 동일하므로 고정
        createTimestamp: currentTimestamp // 생성 시간 기록
      };
      
      // 우측장 높이 - 항상 하부장 높이와 동일하게 설정
      newRightModule.dimensions.height = lowerModule.dimensions.height;
      console.log('우측장 높이가 하부장 기준으로 설정됨:', lowerModule.dimensions.height);
      
      // 높이 수정 불가 표시
      newRightModule.fixedHeight = true;
      
      // 모듈 추가
      modules.push(newRightModule);
      
      console.log('우측장 모듈 추가됨:', newRightModule);
    }
    
    // 모듈 상태 업데이트
    newModuleState.modules = modules;
    setModuleState(newModuleState);
    closeAddModuleModal();
  }

  // 모듈 상태 변경 감지 시 카메라 자동 조정
  useEffect(() => {
    // 초기 렌더링 시에는 처리하지 않음
    if (!prevModuleStateRef.current) {
      prevModuleStateRef.current = {...moduleState};
      return;
    }
    
    const prevModules = prevModuleStateRef.current.modules || [];
    const currentModules = moduleState.modules || [];
    
    // 모듈이 추가/제거되거나 치수 또는 선반 수가 변경된 경우 감지
    const modulesChanged = 
      // 모듈 개수 변경 확인
      prevModules.length !== currentModules.length ||
      // 모듈 치수 또는 선반 개수 변경 확인
      currentModules.some((currentMod, index) => {
        // 새로 추가된 모듈이면 변경으로 처리
        if (index >= prevModules.length) return true;
        
        const prevMod = prevModules[index];
        return (
          currentMod.dimensions.width !== prevMod.dimensions.width ||
          currentMod.dimensions.height !== prevMod.dimensions.height ||
          currentMod.dimensions.depth !== prevMod.dimensions.depth ||
          // 선반 개수 변경 감지
          (currentMod.shelves?.count !== prevMod.shelves?.count)
        );
      });
    
    // 동기화 규칙 적용 (직접 객체 수정, setState 사용 안 함)
    const enforceModuleSyncRules = () => {
      // 모듈 분류
      const baseModule = currentModules.find(m => m.type === 'lower' || m.position === 'base');
      const rightModules = currentModules.filter(m => m.position === 'right');
      const topModules = currentModules.filter(m => m.position === 'top');
      
      if (!baseModule) return false; // 변경 없음
      
      let hasChanges = false;
      
      return hasChanges;
    };
    
    // 모듈 변경 감지 시 동기화 규칙 적용
    if (modulesChanged) {
      console.log('모듈이 변경되어 규칙 및 3D 뷰를 업데이트합니다:', currentModules.length, '개 모듈');
      
      // 동기화 규칙 적용 - 직접 moduleState 객체 수정
      const hasChanges = enforceModuleSyncRules();
      
      // Three.js 초기화 완료된 경우에만 적용
      if (Object.keys(threeRef.current).length > 0) {
        // 먼저 씬 업데이트
        if (threeRef.current.scene) {
          addMultiCabinetModule(threeRef.current.scene, THREE, moduleState);
          threeRef.current.renderer.render(threeRef.current.scene, threeRef.current.camera);
        }
        
        // 약간의 지연을 두고 실행 (렌더링 완료 후)
        setTimeout(() => {
          adjustCameraToModules(moduleState.modules, threeRef.current);
        }, 100);
      }
    }
    
    // 현재 상태를 이전 상태로 저장 (깊은 복사)
    prevModuleStateRef.current = JSON.parse(JSON.stringify(moduleState));
  }, [moduleState]);

  useEffect(() => {
    console.log('ThreeViewer mountRef:', mountRef.current);
    let renderer, scene, camera, perspectiveCamera, orthographicCamera, controls, frameId

    const initThree = () => {
      scene = new THREE.Scene()
      
      // 장면 배경색을 희색 계열로 설정
      scene.background = new THREE.Color(0xf5f5f5)
      
      // 모든 모듈의 치수를 합산하여 전체 크기 계산
      const modules = moduleState.modules || [];
      
      // 기본 값 설정 (만약 모듈 데이터가 없는 경우 대비)
      let totalWidth = 600;
      let totalHeight = 720;
      let totalDepth = 577;
      
      if (modules.length > 0) {
        // 모든 모듈 중 가장 넓은 너비와 깊이 찾기
        totalWidth = Math.max(...modules.map(m => m.dimensions.width));
        totalDepth = Math.max(...modules.map(m => m.dimensions.depth));
        
        // 높이는 모든 모듈의 높이 합산
        totalHeight = modules.reduce((sum, m) => sum + m.dimensions.height, 0);
      }
      
      // 중심점 계산
      const centerX = totalWidth / 2;
      const centerY = totalHeight / 2;
      
      const aspect = mountRef.current.clientWidth / mountRef.current.clientHeight
      
      // 원근 카메라 설정 (3D 모드용)
      perspectiveCamera = new THREE.PerspectiveCamera(30, aspect, 1, 10000)
      
      // 직교 카메라 설정 (2D 모드용)
      const frustumSize = Math.max(totalWidth * 1.5, totalHeight * 1.5)
      orthographicCamera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        frustumSize / -2,
        1,
        10000
      )
      
      // 현재 활성 카메라 설정 (기본값은 원근 카메라)
      camera = viewMode === '3D' ? perspectiveCamera : orthographicCamera
      
      // 가구 크기를 기반으로 적절한 거리 계산 - 더 넓게 보기 위해 값 증가
      const cameraDistance = Math.max(
        totalWidth * 1.3,  // 이전 1.5 -> 1.3로 조정
        totalHeight * 1.3,  // 이전 1.5 -> 1.3로 조정
        totalDepth * 2.5   // 이전 3 -> 2.5로 조정
      );
      
      // 두 카메라 모두에 동일한 위치와 타겟 설정
      const cameraPosition = [centerX, centerY, cameraDistance]
      const cameraTarget = [centerX, centerY, 0]
      
      perspectiveCamera.position.set(...cameraPosition)
      perspectiveCamera.lookAt(...cameraTarget)
      
      orthographicCamera.position.set(...cameraPosition)
      orthographicCamera.lookAt(...cameraTarget)

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight)
      renderer.setPixelRatio(window.devicePixelRatio)
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      if (mountRef.current && !mountRef.current.querySelector('canvas')) {
        mountRef.current.appendChild(renderer.domElement)
      }

      // 조명 개선 - 더 밝고 자연스러운 조명
      const ambient = new THREE.AmbientLight(0xffffff, 0.7)  // 주변광 밝기 증가
      scene.add(ambient)

      // 주 조명 - 정면에서 비추는 조명
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.6)
      dirLight.position.set(0, totalHeight / 2, totalDepth * 4)  // 정면에서 비추도록 조정
      dirLight.castShadow = true
      dirLight.shadow.mapSize.width = 2048
      dirLight.shadow.mapSize.height = 2048
      scene.add(dirLight)

      // 보조 조명 1 - 위에서 비추는 조명
      const topLight = new THREE.DirectionalLight(0xffffff, 0.4)
      topLight.position.set(0, totalHeight * 2, 0)
      topLight.castShadow = true
      scene.add(topLight)
      
      // 보조 조명 2 - 왼쪽에서 비추는 조명
      const leftLight = new THREE.DirectionalLight(0xffffff, 0.3)
      leftLight.position.set(-totalWidth * 2, totalHeight, 0)
      scene.add(leftLight)
      
      // 보조 조명 3 - 오른쪽에서 비추는 조명
      const rightLight = new THREE.DirectionalLight(0xffffff, 0.3)
      rightLight.position.set(totalWidth * 2, totalHeight, 0)
      scene.add(rightLight)

      // OrbitControls 설정 개선 - 줌 아웃 거리 크게 증가
      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.screenSpacePanning = true
      
      // 최소/최대 줌 거리 조정 - 가구 크기에 따라 동적 조정
      const minDistance = Math.max(totalWidth, totalHeight, totalDepth) * 0.6
      const maxDistance = Math.max(totalWidth, totalHeight, totalDepth) * 20 // 최대 거리 크게 증가
      
      controls.minDistance = minDistance
      controls.maxDistance = maxDistance
      controls.maxPolarAngle = Math.PI / 1.2 // 더 넓은 각도 범위 허용
      
      // 초기 회전을 설정하여 가구가 올바르게 보이도록 함
      controls.autoRotate = false
      controls.autoRotateSpeed = 1.0 // 자동 회전 속도
      controls.enableRotate = true  // 사용자가 회전 가능하게 설정
      
      // 정확히 가구 중앙을 타겟으로 설정
      controls.target.set(0, totalHeight / 2, 0)
      controls.update()

      // 가구 모듈 생성
      addMultiCabinetModule(scene, THREE, moduleState)

      // 리사이즈 핸들러
      const handleResize = () => {
        const width = mountRef.current.clientWidth
        const height = mountRef.current.clientHeight
        
        // 원근 카메라 업데이트
        perspectiveCamera.aspect = width / height
        perspectiveCamera.updateProjectionMatrix()
        
        // 직교 카메라 업데이트
        const frustumSize = Math.max(totalWidth * 1.5, totalHeight * 1.5)
        orthographicCamera.left = frustumSize * width / height / -2
        orthographicCamera.right = frustumSize * width / height / 2
        orthographicCamera.top = frustumSize / 2
        orthographicCamera.bottom = frustumSize / -2
        orthographicCamera.updateProjectionMatrix()
        
        renderer.setSize(width, height)
      }
      window.addEventListener('resize', handleResize)

      // 렌더 루프
      const animate = () => {
        controls.update()
        renderer.render(scene, camera)
        frameId = requestAnimationFrame(animate)
      }
      animate()

      threeRef.current = { 
        renderer, 
        scene, 
        camera, 
        perspectiveCamera, 
        orthographicCamera, 
        controls, 
        frameId 
      }

      return () => {
        window.removeEventListener('resize', handleResize)
      }
    }

    initThree()

    return () => {
      if (threeRef.current.frameId) cancelAnimationFrame(threeRef.current.frameId)
      if (threeRef.current.renderer) {
        threeRef.current.renderer.dispose()
      }
      if (mountRef.current) {
        // 기존 canvas만 제거
        const canvas = mountRef.current.querySelector('canvas')
        if (canvas) mountRef.current.removeChild(canvas)
      }
    }
  }, [viewMode])

  return (
    <div className="relative w-full h-full">
      {/* 2D/3D 토글 버튼 */}
      <button 
        className="absolute top-4 right-4 z-10 bg-white text-gray-800 font-bold py-2 px-4 rounded-full shadow-lg hover:bg-gray-100 transition-colors"
        onClick={toggleViewMode}
      >
        {viewMode === '3D' ? '2D 모드로 보기' : '3D 모드로 보기'}
      </button>
      
      {/* 모듈 추가 모달 */}
      {showAddModal && (
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center z-20">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={closeAddModuleModal}></div>
          <div className="bg-white rounded-lg p-6 shadow-xl z-30 w-96">
            <h3 className="text-xl font-bold mb-4">모듈 추가</h3>
            
            {/* 동기화 규칙 설명 */}
            <div className="mb-4 bg-blue-50 p-3 rounded text-sm">
              <h4 className="font-bold text-blue-700">📌 동기화 규칙 안내</h4>
              {moduleState.modules?.some(m => m.position === 'top') ? (
                // 상부장이 이미 있는 경우 (하부장→상부장→우측장 순서)
                <p className="text-blue-600">
                  하부장+상부장이 이미 존재합니다. 추가되는 우측장의 높이는 하부장+상부장의 높이 합계로 자동 설정되며, 수정할 수 없습니다.
                </p>
              ) : moduleState.modules?.some(m => m.position === 'right') ? (
                // 우측장이 이미 있는 경우 (하부장→우측장→상부장 순서)
                <p className="text-blue-600">
                  하부장+우측장이 이미 존재합니다. 추가되는 상부장의 너비는 하부장+우측장의 너비 합계로 자동 설정되며, 수정할 수 없습니다.
                </p>
              ) : (
                // 하부장만 있는 경우
                <p className="text-blue-600">
                  <span className="block">• 상부장 추가 시: 하부장과 동일한 너비와 깊이로 설정되며, 수정할 수 없습니다.</span>
                  <span className="block">• 우측장 추가 시: 하부장과 동일한 높이와 깊이로 설정되며, 수정할 수 없습니다.</span>
                </p>
              )}
            </div>
            
            <div className="flex flex-col space-y-2">
              {/* 상부장 추가 버튼 */}
              <button
                className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors"
                onClick={() => addModule('top')}
              >
                위에 추가 (상부장)
                {moduleState.modules?.some(m => m.position === 'right') ? (
                  <span className="ml-1 text-xs font-normal bg-yellow-200 text-yellow-800 px-1 rounded">
                    너비 자동 설정
                  </span>
                ) : (
                  <span className="ml-1 text-xs font-normal bg-yellow-200 text-yellow-800 px-1 rounded">
                    너비·깊이 동기화
                  </span>
                )}
              </button>
              
              {/* 우측장 추가 버튼 */}
              <button
                className="bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600 transition-colors"
                onClick={() => addModule('right')}
              >
                우측에 추가 (우측장)
                {moduleState.modules?.some(m => m.position === 'top') ? (
                  <span className="ml-1 text-xs font-normal bg-yellow-200 text-yellow-800 px-1 rounded">
                    높이 자동 설정
                  </span>
                ) : (
                  <span className="ml-1 text-xs font-normal bg-yellow-200 text-yellow-800 px-1 rounded">
                    높이·깊이 동기화
                  </span>
                )}
              </button>
              
              <button
                className="bg-gray-300 text-gray-800 py-2 px-4 rounded hover:bg-gray-400 transition-colors mt-4"
                onClick={closeAddModuleModal}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* GLB 불러오기 및 모듈 추가 버튼 */}
      <div className="absolute bottom-4 left-4 z-10 flex space-x-2">
        <label className="bg-white text-gray-800 font-bold py-2 px-4 rounded-full shadow-lg hover:bg-gray-100 transition-colors cursor-pointer">
          GLB 불러오기
          <input
            type="file"
            accept=".glb"
            onChange={handleGlbUpload}
            className="hidden"
          />
        </label>
        
        {glbData && (
          <button
            className="bg-white text-gray-800 font-bold py-2 px-4 rounded-full shadow-lg hover:bg-gray-100 transition-colors"
            onClick={convertGlbToModule}
          >
            JSON 변환
          </button>
        )}
        
        <button 
          className="bg-blue-500 text-white font-bold py-2 px-4 rounded-full shadow-lg hover:bg-blue-600 transition-colors"
          onClick={openAddModuleModal}
        >
          모듈 추가
        </button>
      </div>
      
      {/* 뷰어 컨테이너 */}
      <div
        ref={mountRef}
        className="w-full h-full min-h-[800px] bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl shadow-lg overflow-hidden"
      />
    </div>
  )
}

// 모듈 위치 계산 함수 (하부장 → 우측장 → 상부장 기준)
function computeModulePosition(module, allModules) {
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

function addMultiCabinetModule(scene, THREE, moduleState) {
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

// 기존 단일 모듈용 함수는 유지 (이전 코드와의 호환성 위해)
function addCabinetModule(scene, THREE, moduleState) {
  // 모듈 구조로 변환된 경우, 기존 모듈 형식으로 처리
  if (moduleState.modules && moduleState.modules.length > 0) {
    return addMultiCabinetModule(scene, THREE, moduleState);
  }
  
  // 이전 코드: 단일 모듈 처리 로직
  // ... existing code ...
  scene.children = scene.children.filter(child => !(child.isMesh && child.userData.isModulePart));
  
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
    topPanel.position.set(centerX, position.y + height - thickness / 2, centerZ);
    panels.push(topPanel);
  }
  
  // 하판 (해당 역할이 true일 때만 추가)
  if (moduleState.panels && moduleState.panels.hasBottom) {
    const bottomPanel = new THREE.Mesh(
      new THREE.BoxGeometry(width, thickness, depth),
      material
    );
    bottomPanel.position.set(centerX, position.y + thickness / 2, centerZ);
    panels.push(bottomPanel);
  }
  
  // 뒷판 (해당 역할이 true일 때만 추가)
  if (moduleState.panels && moduleState.panels.hasBack) {
    const backPanel = new THREE.Mesh(
      new THREE.BoxGeometry(width - thickness * 2, height - thickness * 2, thickness),
      material
    );
    backPanel.position.set(centerX, centerY, centerZ - depth / 2 + thickness / 2);
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
      const shelfY = position.y + thickness + spaceBetweenShelves * (i + 1);
      shelfMesh.position.set(centerX, shelfY, centerZ);
      
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
      edges.userData.moduleId = shelfMesh.userData.moduleId;
      shelfMesh.userData.outline2D = edges;
      shelfMesh.add(edges);
      
      scene.add(shelfMesh);
    }
  }
}

export default ThreeViewer