import { useState } from 'react'

const defaultState = {
  name: '',
  type: 'cabinet',
  modules: [
    {
      id: 'lower',
      type: 'lower', // 하부장
      position: 'base', // 기본 위치
      dimensions: {
        width: 600,
        height: 720,
        depth: 577
      },
      panelThickness: 18,
      panels: {
        hasTop: true,
        hasBottom: true,
        hasLeft: true,
        hasRight: true,
        hasBack: true
      },
      material: 'melamine_white',
      shelves: {
        count: 1,
        distribution: 'equal',
        positions: []
      }
    }
  ]
}

export default function useModuleState() {
  const [moduleState, setModuleState] = useState(defaultState)
  
  const updateModuleState = (newState) => setModuleState(newState)
  
  const resetModule = () => setModuleState(defaultState)
  
  // 모듈 추가 함수 - position 파라미터 추가
  const addModule = (position = 'top') => {
    // 하부장 모듈을 참조
    const lowerModule = moduleState.modules.find(m => m.type === 'lower');
    
    // 고유 ID 생성
    const moduleId = `module_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // 추가되는 모듈의 설정
    let newModule = {
      id: moduleId,
      position: position, // 위치 정보 저장
      panelThickness: lowerModule.panelThickness,
      material: lowerModule.material,
      shelves: {
        count: 1,
        distribution: 'equal',
        positions: []
      }
    };
    
    // 위치에 따라 다른 설정 적용
    if (position === 'top') {
      // 하부 모듈들 찾기 (하부장 + 우측 모듈들)
      const lowerModules = moduleState.modules.filter(m => 
        m.type === 'lower' || m.position === 'right'
      );
      
      // 우측 모듈이 있는지 확인
      const hasRightModules = lowerModules.some(m => m.position === 'right');
      
      // 모든 하부 모듈들의 너비 합산
      const totalWidth = lowerModules.reduce((sum, m) => sum + m.dimensions.width, 0);
      
      // 상부장 - 위에 쌓는 경우
      newModule = {
        ...newModule,
        type: 'upper',
        dimensions: {
          // 하부 모듈이 여러 개인 경우 모든 모듈의 width 합산
          width: hasRightModules ? totalWidth : lowerModule.dimensions.width,
          height: 500, // 기본 높이 설정
          depth: lowerModule.dimensions.depth // 깊이는 하부장과 동일
        },
        // 너비 고정 여부 설정 (우측 모듈이 있는 경우만 고정)
        fixedWidth: hasRightModules,
        panels: { 
          // 모든 패널 포함
          hasTop: true,
          hasBottom: true,
          hasLeft: true,
          hasRight: true,
          hasBack: true
        }
      };
    } else if (position === 'right') {
      // 우측장 - 우측에 붙이는 경우
      newModule = {
        ...newModule,
        type: 'right',
        dimensions: {
          width: 400, // 기본 너비 설정 (사용자가 변경 가능)
          height: lowerModule.dimensions.height, // 높이는 하부장과 동일
          depth: lowerModule.dimensions.depth // 깊이는 하부장과 동일
        },
        panels: { 
          // 좌측판 제외하고 모든 패널 포함
          hasTop: true,
          hasBottom: true,
          hasLeft: false, // 좌측판 제외
          hasRight: true,
          hasBack: true
        }
      };
    }
    
    setModuleState({
      ...moduleState,
      modules: [...moduleState.modules, newModule]
    });
  };
  
  // 특정 모듈 업데이트 함수
  const updateModule = (moduleId, data) => {
    console.log(`updateModule 호출: ${moduleId}`, data);
    
    // 현재 모듈 찾기
    const moduleToUpdate = moduleState.modules.find(module => module.id === moduleId);
    
    if (!moduleToUpdate) {
      console.error(`모듈 ID ${moduleId}를 찾을 수 없습니다.`);
      return;
    }
    
    // 패널 변경이 포함된 경우 확인
    if (data.panels) {
      console.log('패널 업데이트 감지:', data.panels);
    }
    
    // 하부장의 너비, 높이, 깊이가 변경될 때 관련 모듈 동기화
    if (moduleId === 'lower' && data.dimensions) {
      const { width: newWidth, height: newHeight, depth: newDepth } = data.dimensions;
      const widthChanged = newWidth !== undefined && newWidth !== moduleToUpdate.dimensions.width;
      const heightChanged = newHeight !== undefined && newHeight !== moduleToUpdate.dimensions.height;
      const depthChanged = newDepth !== undefined && newDepth !== moduleToUpdate.dimensions.depth;
      
      if (widthChanged || heightChanged || depthChanged) {
        // 모든 하부 모듈 찾기 (하부장 + 우측 모듈)
        const lowerModules = moduleState.modules.filter(m => 
          m.type === 'lower' || m.position === 'right'
        );
        
        // 위쪽 모듈 찾기
        const topModules = moduleState.modules.filter(m => m.position === 'top');
        
        // 모든 하부 모듈의 너비 합산 (너비가 변경된 경우)
        let totalLowerWidth = null;
        if (widthChanged) {
          totalLowerWidth = lowerModules.reduce((sum, m) => {
            // 현재 업데이트 중인 모듈의 경우 새 값 사용
            if (m.id === moduleId) {
              return sum + newWidth;
            }
            return sum + m.dimensions.width;
          }, 0);
        }

        const updatedModules = moduleState.modules.map(module => {
          if (module.id === moduleId) {
            // 하부장 자체 업데이트
            return { ...module, ...data };
          } else if (module.position === 'top') {
            // 상부장 업데이트
            const updatedDimensions = { ...module.dimensions };
            
            // 단일 하부장 위의 상부장이거나 고정 너비인 경우
            if (module.fixedWidth && widthChanged) {
              // 모든 하부 모듈의 너비 합으로 업데이트
              updatedDimensions.width = totalLowerWidth;
            } else if (!module.fixedWidth && widthChanged) {
              // 단일 하부장 위의 상부장인 경우
              updatedDimensions.width = newWidth;
            }
            
            // 깊이 변경 시 모든 상부장 깊이 동기화
            if (depthChanged) updatedDimensions.depth = newDepth;
            
            return {
              ...module,
              dimensions: updatedDimensions
            };
          } else if (module.position === 'right') {
            // 우측장 업데이트 (높이와 깊이만)
            const updatedDimensions = { ...module.dimensions };
            
            if (heightChanged) updatedDimensions.height = newHeight;
            if (depthChanged) updatedDimensions.depth = newDepth;
            
            return {
              ...module,
              dimensions: updatedDimensions
            };
          }
          return module;
        });
        
        setModuleState({
          ...moduleState,
          modules: updatedModules
        });
        return;
      }
    } else if (data.dimensions && moduleToUpdate.position === 'right') {
      // 우측 모듈의 너비가 변경된 경우, 상부 fixedWidth 모듈 업데이트
      const { width: newWidth } = data.dimensions;
      const widthChanged = newWidth !== undefined && newWidth !== moduleToUpdate.dimensions.width;
      
      if (widthChanged) {
        // 모든 하부 모듈 찾기 (하부장 + 우측 모듈)
        const lowerModules = moduleState.modules.filter(m => 
          m.type === 'lower' || m.position === 'right'
        );
        
        // 새 너비를 반영해서 하부 모듈 총 너비 계산
        const totalLowerWidth = lowerModules.reduce((sum, m) => {
          // 현재 업데이트 중인 모듈의 경우 새 값 사용
          if (m.id === moduleId) {
            return sum + newWidth;
          }
          return sum + m.dimensions.width;
        }, 0);
        
        // 고정 너비 상부 모듈 찾기
        const fixedWidthTopModules = moduleState.modules.filter(m => 
          m.position === 'top' && m.fixedWidth
        );
        
        if (fixedWidthTopModules.length > 0) {
          // 너비 변경 시 fixedWidth 상부 모듈도 업데이트
          const updatedModules = moduleState.modules.map(module => {
            if (module.id === moduleId) {
              // 현재 우측 모듈 자체 업데이트
              return { 
                ...module, 
                ...data 
              };
            } else if (module.position === 'top' && module.fixedWidth) {
              // 고정 너비 상부 모듈 업데이트
              return {
                ...module,
                dimensions: {
                  ...module.dimensions,
                  width: totalLowerWidth
                }
              };
            }
            return module;
          });
          
          setModuleState({
            ...moduleState,
            modules: updatedModules
          });
          return;
        }
      }
    }
    
    // 일반적인 업데이트 케이스 - 특히 panels 변경 처리 강화
    const updatedModules = moduleState.modules.map(module => {
      if (module.id === moduleId) {
        // 모듈 패널 업데이트를 위한 특별 처리
        if (data.panels) {
          // 새 panels 객체가 완전한 상태인지 확인
          const updatedPanels = {
            ...module.panels,  // 기존 패널 상태 유지
            ...data.panels     // 새 패널 상태로 업데이트
          };
          
          // 변경 내용 로깅
          console.log('최종 패널 상태:', updatedPanels);
          
          // 패널 변경이 있는 경우 재구성된 모듈 반환
          return {
            ...module,         // 기존 모듈 상태 유지
            ...data,           // 새 데이터로 업데이트
            panels: updatedPanels  // 병합된 패널 상태 사용
          };
        }
        
        // 일반 업데이트
        return { ...module, ...data };
      }
      return module;
    });
    
    setModuleState({
      ...moduleState,
      modules: updatedModules
    });
  };
  
  return [moduleState, updateModuleState, resetModule, addModule, updateModule]
}
