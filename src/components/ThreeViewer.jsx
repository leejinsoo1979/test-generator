import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

// 유틸리티 import
import { adjustCameraToModules, updateViewMode } from '../utils/three/cameraUtils'
import { computeModulePosition, extractJsonFromGltf, parseModuleDataFromGLB } from '../utils/three/moduleUtils'
import { addMultiCabinetModule, addCabinetModule } from '../utils/three/moduleRenderer'

const ThreeViewer = ({ moduleState, setModuleState, selectedPanelColor, activePanelId, panelColors }) => {
  const mountRef = useRef(null)
  const threeRef = useRef({})
  const [viewMode, setViewMode] = useState('3D') // 기본값은 3D 모드
  const [glbData, setGlbData] = useState(null) // GLB 파일 데이터
  const [showAddModal, setShowAddModal] = useState(false) // 모듈 추가 모달 표시 여부
  const [selectedModuleId, setSelectedModuleId] = useState(null) // 선택된 모듈 ID
  const prevModuleStateRef = useRef(null) // 이전 모듈 상태 참조
  const originalMaterialColors = useRef({}) // 원래 패널 색상 저장용

  // 모듈 초기화 - 컴포넌트 마운트 시 기본 모듈이 없으면 생성
  useEffect(() => {
    // 모듈이 없을 경우 기본 하부장 생성
    if (!moduleState.modules || moduleState.modules.length === 0) {
      initializeDefaultModule();
    }
  }, []);

  // 모듈 상태가 변경될 때마다 3D 뷰 업데이트
  useEffect(() => {
    console.log('모듈 상태 변경 감지:', moduleState);
    
    // 3D 객체가 초기화되었는지 확인
    if (threeRef.current && threeRef.current.scene && threeRef.current.renderer) {
      // 이전 모든 모듈 제거 후 다시 렌더링
      const scene = threeRef.current.scene;
      
      // 이전 모듈 구성요소 제거
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
      
      // 모듈 렌더링 업데이트
      addMultiCabinetModule(threeRef.current.scene, THREE, moduleState);
      
      // 선반 가시성 업데이트
      setTimeout(() => {
        const scene = threeRef.current.scene;
        // 씬의 모든 메시 객체를 순회하며 선반 가시성만 처리
        scene.traverse(object => {
          if (object.isMesh && object.userData && object.userData.panelId) {
            // 선반 패널의 경우 visibility 확인 및 적용
            if (object.userData.panelType === 'shelf' && object.userData.shelfIndex !== undefined) {
              const moduleId = object.userData.moduleId;
              const shelfIndex = object.userData.shelfIndex;
              const module = moduleState.modules.find(m => m.id === moduleId);
              
              if (module && module.shelves) {
                // 선반 가시성 배열이 존재하는지 확인
                if (module.shelves.visibility && Array.isArray(module.shelves.visibility)) {
                  // visibility 배열에 해당 인덱스의 값이 false면 숨김 처리
                  const isVisible = module.shelves.visibility[shelfIndex] !== false;
                  
                  // 가시성 변경 시 콘솔에 로그 출력
                  if (object.visible !== isVisible) {
                    console.log(`선반 가시성 변경: ${moduleId} 선반 ${shelfIndex}, 새 상태: ${isVisible ? '보임' : '숨김'}`);
                  }
                  
                  object.visible = isVisible;
                  
                  // 객체에 연결된 윤곽선(2D 모드용)도 같은 가시성 적용
                  if (object.userData.outline2D) {
                    object.userData.outline2D.visible = viewMode === '2D' && isVisible;
                  }
                } else {
                  // 가시성 배열이 없으면 기본적으로 보이도록 설정
                  object.visible = true;
                  
                  if (object.userData.outline2D) {
                    object.userData.outline2D.visible = viewMode === '2D';
                  }
                }
              }
            }
          }
        });
        
        // 패널 색상 업데이트 (선택된 패널 색상은 별도의 useEffect에서 처리)
        updatePanelColors();
        
        // 씬 렌더링
        threeRef.current.renderer.render(
          threeRef.current.scene,
          threeRef.current.camera
        );
      }, 100);
      
      console.log('3D 뷰 업데이트 완료');
    }
  }, [moduleState, viewMode]); // 모듈 상태 변경 시에만 재실행

  // 패널 색상 적용을 위한 함수 정의
  const updatePanelColors = () => {
    if (!threeRef.current || !threeRef.current.scene) return;
    
    const scene = threeRef.current.scene;
    
    // 모든 패널을 기본 색상으로 설정
    scene.traverse(object => {
      if (object.isMesh && object.userData && object.userData.panelId) {
        if (object.material && object.visible) {
          // 기본 그레이 색상 (연한 그레이)
          const defaultColor = new THREE.Color(0xE0E0E0);
          
          // 현재 선택된 패널이 아닌 경우 기본 색상으로
          if (object.userData.panelId !== activePanelId) {
            if (Array.isArray(object.material)) {
              object.material.forEach(mat => {
                mat.color.copy(defaultColor);
              });
            } else {
              object.material.color.copy(defaultColor);
            }
          }
        }
      }
    });
    
    // 선택된 패널에만 선택 색상 적용
    if (selectedPanelColor && activePanelId) {
      scene.traverse(object => {
        if (object.isMesh && object.userData && object.userData.panelId === activePanelId && object.visible) {
          const { color } = selectedPanelColor;
          
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(mat => {
                mat.color.setRGB(color[0], color[1], color[2]);
              });
            } else {
              object.material.color.setRGB(color[0], color[1], color[2]);
            }
          }
        }
      });
    }
    
    // 렌더링 요청
    if (threeRef.current.renderer && threeRef.current.camera) {
      threeRef.current.renderer.render(
        threeRef.current.scene,
        threeRef.current.camera
      );
    }
  };

  // 패널 색상 변경 감지하여 적용
  useEffect(() => {
    console.log('패널 색상 변경 감지:', activePanelId);
    updatePanelColors();
  }, [selectedPanelColor, activePanelId]);

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

  // HSL 또는 HEX 색상 문자열을 RGB 배열로 변환
  const hslToRgb = (hslColor) => {
    // HSL 문자열인 경우
    if (hslColor.startsWith('hsl')) {
      // HSL을 실제 RGB로 변환
      const hslMatch = /hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/.exec(hslColor);
      if (hslMatch) {
        const h = parseInt(hslMatch[1]) / 360;
        const s = parseInt(hslMatch[2]) / 100;
        const l = parseInt(hslMatch[3]) / 100;
        
        let r, g, b;
        
        if (s === 0) {
          r = g = b = l; // 회색 계열
        } else {
          const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
          };
          
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const p = 2 * l - q;
          
          r = hue2rgb(p, q, h + 1/3);
          g = hue2rgb(p, q, h);
          b = hue2rgb(p, q, h - 1/3);
        }
        
        return [r, g, b]; // Three.js에서는 이미 0-1 범위를 사용하므로 그대로 반환
      }
    }
    
    // Canvas 방식으로 변환 시도
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = hslColor;
      ctx.fillRect(0, 0, 1, 1);
      const data = ctx.getImageData(0, 0, 1, 1).data;
      return [data[0] / 255, data[1] / 255, data[2] / 255]; // 0~1 범위로 정규화
    } catch (e) {
      console.error('색상 변환 오류:', e);
      return [1, 1, 1]; // 흰색(기본값)
    }
  }

  // 2D/3D 모드 토글 핸들러
  const toggleViewMode = () => {
    // 모드 전환
    const newMode = viewMode === '3D' ? '2D' : '3D';
    setViewMode(newMode);
    
    // Three.js 객체가 초기화되지 않은 경우 처리 안함
    if (!threeRef.current || !threeRef.current.scene) {
      console.error('Three.js 초기화되지 않음');
      return;
    }
    
    const scene = threeRef.current.scene;
    
    if (newMode === '2D') {
      // ==== 2D 모드 (와이어프레임만 표시) ====
      scene.traverse(object => {
        if (object.isMesh && object.userData.isModulePart) {
          // 메시는 숨기고 와이어프레임만 표시
          object.visible = false;
          
          // 와이어프레임이 없는 경우 생성
          if (!object.userData.outline2D) {
            // 윤곽선 효과 생성
            const edgesGeometry = new THREE.EdgesGeometry(object.geometry, 1);
            const edgesMaterial = new THREE.LineBasicMaterial({
              color: 0x000000,
              linewidth: 2
            });
            
            const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
            edges.renderOrder = 999;
            edges.material.depthTest = false;
            edges.userData.isModuleOutline = true;
            if (object.userData.moduleId) {
              edges.userData.moduleId = object.userData.moduleId;
            }
            if (object.userData.panelId) {
              edges.userData.panelId = object.userData.panelId;
            }
            if (object.userData.panelType) {
              edges.userData.panelType = object.userData.panelType;
            }
            
            object.userData.outline2D = edges;
            object.add(edges);
            
            console.log(`와이어프레임 생성됨: ${object.userData.panelId || '알 수 없는 패널'}`);
          }
          
          // 아웃라인 표시 - 모든 패널에 적용
          if (object.userData.outline2D) {
            // 선반 가시성 상태를 확인
            let isVisible = true;
            
            // 선반인 경우 가시성 상태 확인
            if (object.userData.panelType === 'shelf' && object.userData.shelfIndex !== undefined) {
              const moduleId = object.userData.moduleId;
              const shelfIndex = object.userData.shelfIndex;
              const module = moduleState.modules.find(m => m.id === moduleId);
              
              if (module && module.shelves && module.shelves.visibility && 
                  Array.isArray(module.shelves.visibility)) {
                isVisible = module.shelves.visibility[shelfIndex] !== false;
              }
            }
            
            object.userData.outline2D.visible = isVisible;
            
            // 패널 ID에 해당하는 색상 적용
            if (object.userData.panelId && panelColors[object.userData.panelId]) {
              // 색상 변환
              let color;
              try {
                const colorStr = panelColors[object.userData.panelId];
                
                if (colorStr.startsWith('hsl')) {
                  // HSL 색상 변환
                  const rgb = hslToRgb(colorStr);
                  color = new THREE.Color(rgb[0], rgb[1], rgb[2]);
                } else {
                  // 직접 색상 설정
                  color = new THREE.Color(colorStr);
                }
                
                // 와이어프레임에 색상 적용
                object.userData.outline2D.material.color.copy(color);
              } catch (e) {
                console.error('와이어프레임 색상 적용 오류:', e);
              }
            }
          }
        }
      });
      
      // 그리드 바닥면 색상 변경 (2D 모드에서는 더 밝게)
      if (threeRef.current.gridHelper) {
        threeRef.current.gridHelper.material.opacity = 0.1;
      }
      
      // 좀 더 평평한 조명으로 변경
      if (threeRef.current.directionalLight) {
        threeRef.current.directionalLight.intensity = 0.3;
      }
      
      // 카메라 위치 변경 - 상단 뷰
      updateViewMode(threeRef.current, '2D');
    } else {
      // ==== 3D 모드 (표준 3D 뷰) ====
      scene.traverse(object => {
        if (object.isMesh && object.userData.isModulePart) {
          // 패널의 가시성 상태에 따라 메시 표시 여부 결정
          let isVisible = true;
          
          // 선반인 경우 가시성 상태 확인
          if (object.userData.panelType === 'shelf' && object.userData.shelfIndex !== undefined) {
            const moduleId = object.userData.moduleId;
            const shelfIndex = object.userData.shelfIndex;
            const module = moduleState.modules.find(m => m.id === moduleId);
            
            if (module && module.shelves && module.shelves.visibility && 
                Array.isArray(module.shelves.visibility)) {
              isVisible = module.shelves.visibility[shelfIndex] !== false;
            }
          }
          
          object.visible = isVisible;
          
          // 와이어프레임 숨김
          if (object.userData.outline2D) {
            object.userData.outline2D.visible = false;
          }
        }
      });
      
      // 그리드 바닥면 원래대로 복원
      if (threeRef.current.gridHelper) {
        threeRef.current.gridHelper.material.opacity = 0.2;
      }
      
      // 조명 원래대로 복원
      if (threeRef.current.directionalLight) {
        threeRef.current.directionalLight.intensity = 0.8;
      }
      
      // 카메라 위치 복원 - 3D 등각 뷰
      updateViewMode(threeRef.current, '3D');
    }
    
    // 렌더링 업데이트
    if (threeRef.current.renderer && threeRef.current.camera) {
      threeRef.current.renderer.render(scene, threeRef.current.camera);
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
  
  // JSON 데이터를 모듈 상태로 변환
  const convertGlbToModule = () => {
    if (!glbData) return;
    
    console.log('GLB 데이터를 모듈 상태로 변환 시작:', glbData);
    
    try {
      // 가져온 데이터를 기반으로 모듈 상태 구성 (향상된 함수 사용)
      const newModuleState = parseModuleDataFromGLB(glbData);
      
      // 모듈이 비어있는 경우 처리
      if (!newModuleState.modules || newModuleState.modules.length === 0) {
        console.error('변환할 모듈 정보가 없습니다.');
        alert('GLB 파일에서 모듈 정보를 추출할 수 없습니다.');
        return;
      }
      
      console.log('변환된 모듈 상태:', newModuleState);
      
      // 상태 업데이트
      setModuleState(newModuleState);
      
      // 씬 재생성
      if (threeRef.current.scene) {
        // 이전 모델 제거
        const scene = threeRef.current.scene;
        const toRemove = [];
        scene.traverse(child => {
          if (child.isMesh) {
            toRemove.push(child);
          }
        });
        toRemove.forEach(obj => scene.remove(obj));
        
        // 새 모듈 추가
        addMultiCabinetModule(scene, THREE, newModuleState);
        
        // 카메라 조정
        adjustCameraToModules(newModuleState.modules, threeRef.current);
        
        // 렌더링 업데이트
        threeRef.current.renderer.render(scene, threeRef.current.camera);
      }
      
      alert('GLB 데이터를 성공적으로 변환했습니다.');
    } catch (error) {
      console.error('GLB 데이터 변환 중 오류 발생:', error);
      alert('변환 중 오류가 발생했습니다: ' + error.message);
    }
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
      
      // 모든 우측장 모듈의 좌측 패널 제거
      rightModules.forEach(rightModule => {
        if (rightModule.panels.hasLeft !== false) {
          console.log('우측장의 좌측 패널 제거:', rightModule.id);
          rightModule.panels.hasLeft = false;
          hasChanges = true;
        }
      });
      
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
        }, 300); // 지연 시간을 300ms로 증가하여 씬 업데이트가 완전히 완료되도록 함
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
      perspectiveCamera = new THREE.PerspectiveCamera(25, aspect, 1, 20000)
      
      // 직교 카메라 설정 (2D 모드용)
      const frustumSize = Math.max(totalWidth * 1.8, totalHeight * 1.8)
      orthographicCamera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        frustumSize / -2,
        1,
        20000
      )
      
      // 현재 활성 카메라 설정 (기본값은 원근 카메라)
      camera = viewMode === '3D' ? perspectiveCamera : orthographicCamera
      
      // 가구 크기를 기반으로 적절한 거리 계산 - 전체 가구가 잘 보이도록 조정
      const cameraDistance = Math.max(
        totalWidth * 2.0,  // 더 멀리 보기 위해 값 증가
        totalHeight * 2.0,  // 더 멀리 보기 위해 값 증가
        totalDepth * 3.5   // 깊이 방향으로 더 멀리 보기
      );
      
      // 두 카메라 모두에 동일한 위치와 타겟 설정
      // 완전 정면에서 가구를 바라보도록 설정
      const cameraPosition = [
        centerX, // 정중앙에서 바라보기
        centerY, 
        cameraDistance
      ];
      const cameraTarget = [centerX, centerY, 0];
      
      // 초기 카메라 위치와 타겟 저장 (리셋용)
      threeRef.current.initialCameraPosition = [...cameraPosition];
      threeRef.current.initialCameraTarget = [...cameraTarget];
      
      perspectiveCamera.position.set(...cameraPosition);
      perspectiveCamera.lookAt(...cameraTarget);
      
      orthographicCamera.position.set(...cameraPosition);
      orthographicCamera.lookAt(...cameraTarget);

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

      // 초기 카메라 위치 조정
      // 먼저 기본 위치 설정 - 이후 adjustCameraToModules에서 더 정확하게 조정됨
      const initialCameraPosition = [
        totalWidth / 2,
        totalHeight / 2,
        Math.max(totalWidth * 2.0, totalHeight * 2.0, totalDepth * 3.5)
      ];
      const initialTarget = [totalWidth / 2, totalHeight / 2, 0];
      
      perspectiveCamera.position.set(...initialCameraPosition);
      perspectiveCamera.lookAt(...initialTarget);
      orthographicCamera.position.set(...initialCameraPosition);
      orthographicCamera.lookAt(...initialTarget);

      // OrbitControls 설정 개선 - 줌 아웃 거리 크게 증가
      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.screenSpacePanning = true
      
      // 최소/최대 줌 거리 조정 - 가구 크기에 따라 동적 조정
      const minDistance = Math.max(totalWidth, totalHeight, totalDepth) * 0.8
      const maxDistance = Math.max(totalWidth, totalHeight, totalDepth) * 20 // 최대 거리 크게 증가
      
      controls.minDistance = minDistance
      controls.maxDistance = maxDistance
      controls.maxPolarAngle = Math.PI / 1.5 // 더 넓은 각도 범위 허용
      
      // 초기 회전을 설정하여 가구가 올바르게 보이도록 함
      controls.autoRotate = false
      controls.autoRotateSpeed = 1.0 // 자동 회전 속도
      controls.enableRotate = true  // 사용자가 회전 가능하게 설정
      
      // 정확히 가구 중앙을 타겟으로 설정
      controls.target.set(centerX, centerY, 0)
      controls.update()

      // 카메라 초기 위치로 리셋하는 함수 (초기화 버튼에서 호출됨)
      const resetCameraPosition = () => {
        // 카메라 위치와 타겟 부드럽게 리셋
        const initialPos = threeRef.current.initialCameraPosition;
        const initialTarget = threeRef.current.initialCameraTarget;
        
        // GSAP 같은 라이브러리가 없으므로 간단한 애니메이션 구현
        const startPos = camera.position.clone();
        const startTarget = controls.target.clone();
        const duration = 1000; // 1초간 애니메이션
        const startTime = Date.now();
        
        function animateReset() {
          const elapsedTime = Date.now() - startTime;
          const progress = Math.min(elapsedTime / duration, 1);
          // Easing function - ease-out
          const easeProgress = 1 - Math.pow(1 - progress, 3);
          
          // 카메라 위치 보간
          camera.position.x = startPos.x + (initialPos[0] - startPos.x) * easeProgress;
          camera.position.y = startPos.y + (initialPos[1] - startPos.y) * easeProgress;
          camera.position.z = startPos.z + (initialPos[2] - startPos.z) * easeProgress;
          
          // 타겟 위치 보간
          controls.target.x = startTarget.x + (initialTarget[0] - startTarget.x) * easeProgress;
          controls.target.y = startTarget.y + (initialTarget[1] - startTarget.y) * easeProgress;
          controls.target.z = startTarget.z + (initialTarget[2] - startTarget.z) * easeProgress;
          
          controls.update();
          
          if (progress < 1) {
            requestAnimationFrame(animateReset);
          }
        }
        
        animateReset();
      };
      
      // 참조에 저장 (초기화 버튼에서 사용)
      threeRef.current.resetCameraPosition = resetCameraPosition;

      // 가구 모듈 생성
      addMultiCabinetModule(scene, THREE, moduleState)
      
      // 패널 색상 적용 - PanelList에서 사용하는 색상과 동일하게 적용
      setTimeout(() => {
        if (Object.keys(panelColors).length > 0) {
          // 씬의 모든 메시 객체를 순회하며 패널에 색상 적용
          scene.traverse(object => {
            if (object.isMesh && object.userData && object.userData.panelId) {
              const panelId = object.userData.panelId;
              if (panelColors[panelId]) {
                try {
                  // 색상 변환 및 적용
                  let color;
                  const colorStr = panelColors[panelId];
                  
                  if (colorStr.startsWith('hsl')) {
                    // HSL 색상 변환
                    const rgb = hslToRgb(colorStr);
                    color = new THREE.Color(rgb[0], rgb[1], rgb[2]);
                  } else {
                    // 직접 색상 설정
                    color = new THREE.Color(colorStr);
                  }
                  
                  // 객체의 재질에 색상 적용
                  if (object.material) {
                    if (Array.isArray(object.material)) {
                      object.material.forEach(mat => {
                        mat.color.copy(color);
                      });
                    } else {
                      object.material.color.copy(color);
                    }
                    
                    // 원래 색상 저장
                    originalMaterialColors.current[panelId] = [
                      color.r, color.g, color.b
                    ];
                  }
                } catch (e) {
                  console.error('패널 색상 적용 오류:', e);
                }
              }
            }
          });
          
          // 씬 업데이트
          renderer.render(scene, camera);
        }
      }, 100);
      
      // 초기 카메라 위치 모듈에 맞게 조정
      setTimeout(() => {
        adjustCameraToModules(moduleState.modules, {
          perspectiveCamera,
          orthographicCamera, 
          camera,
          controls,
          scene,
          renderer
        });
      }, 300);

      // 리사이즈 핸들러
      const handleResize = () => {
        const width = mountRef.current.clientWidth
        const height = mountRef.current.clientHeight
        
        // 원근 카메라 업데이트
        perspectiveCamera.aspect = width / height
        perspectiveCamera.updateProjectionMatrix()
        
        // 직교 카메라 업데이트
        const frustumSize = Math.max(totalWidth * 1.8, totalHeight * 1.8)
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
        ...threeRef.current,
        renderer, 
        scene, 
        camera, 
        perspectiveCamera, 
        orthographicCamera, 
        controls, 
        frameId,
        resetCameraPosition,
        initialCameraPosition: cameraPosition,
        initialCameraTarget: cameraTarget
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
        onClick={toggleViewMode}
        className="absolute top-2 right-2 z-10 bg-white shadow-md rounded-full p-2"
        title={viewMode === '3D' ? '2D 뷰로 변경' : '3D 뷰로 변경'}
      >
        {viewMode === '3D' ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        )}
      </button>
      
      {/* 초기화 버튼 - 카메라 위치 초기화 */}
      <button 
        className="absolute top-2 right-12 z-10 bg-white shadow-md rounded-full p-2"
        onClick={() => threeRef.current.resetCameraPosition && threeRef.current.resetCameraPosition()}
        title="시점 초기화"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
      
      {/* 모듈 추가 모달 */}
      {showAddModal && (
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center z-20">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={closeAddModuleModal}></div>
          <div className="bg-white rounded-lg p-6 shadow-xl z-30 w-96">
            <h3 className="text-xl font-bold mb-4">모듈 추가</h3>
            
            {/* 동기화 규칙 설명 */}
            <p className="text-sm text-gray-600 mb-4">
              모듈을 추가하면 기존 모듈과 크기가 동기화됩니다:
              <ul className="list-disc pl-5 mt-1">
                <li>상부장: 하부장과 깊이 동기화</li>
                <li>우측장: 하부장과 높이, 깊이 동기화</li>
              </ul>
            </p>
            
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
      <div className="absolute bottom-2 left-2 z-10 flex space-x-2">
        <label className="bg-white text-gray-800 py-2 px-3 rounded-lg shadow-md hover:bg-gray-100 transition-colors cursor-pointer text-sm flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
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
            className="bg-white text-gray-800 py-2 px-3 rounded-lg shadow-md hover:bg-gray-100 transition-colors text-sm flex items-center"
            onClick={convertGlbToModule}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            JSON 변환
          </button>
        )}
        
        <button 
          className="bg-blue-500 text-white py-2 px-3 rounded-lg shadow-md hover:bg-blue-600 transition-colors text-sm flex items-center"
          onClick={openAddModuleModal}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          모듈 추가
        </button>
      </div>

      {/* 뷰어 컨테이너 */}
      <div
        ref={mountRef}
        id="furniture-viewer"
        data-viewer-container="true"
        data-pdf-capture="true"
        className="w-full h-full min-h-[800px] bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl shadow-lg overflow-hidden"
        style={{ position: 'relative' }}
      />
    </div>
  );
};

export default ThreeViewer; 