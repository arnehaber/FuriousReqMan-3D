/**
 * editor_export.js
 * Generiert sauberen Three.js-Code für entities.js aus der aktuellen 3D-Szene.
 */

function generateExportCode() {
    if (typeof commitPendingGuiTransform === 'function') commitPendingGuiTransform();
    if (!currentPig) return;

    const fmt = (n) => {
        const v = Math.round((Number(n) || 0) * 10000) / 10000;
        return Object.is(v, -0) ? '0' : String(v);
    };

    const trimDefaults = (args, defaults) => {
        const out = [...args];
        while (out.length > 0 && out[out.length - 1] === defaults[out.length - 1]) {
            out.pop();
        }
        return out;
    };

    const reservedWords = new Set([
        'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
        'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if',
        'import', 'in', 'instanceof', 'new', 'return', 'super', 'switch', 'this', 'throw',
        'try', 'typeof', 'var', 'void', 'while', 'with', 'yield', 'let', 'static', 'enum',
        'await', 'implements', 'interface', 'package', 'private', 'protected', 'public',
        'group', 'legs', 'THREE'
    ]);

    const usedVars = new Set();
    const makeUniqueVar = (rawName, fallback = 'obj') => {
        let base = (rawName || fallback).replace(/[^a-zA-Z0-9_$]/g, '_');
        if (!base || /^[0-9]/.test(base)) base = '_' + base;
        if (reservedWords.has(base)) base += '_obj';
        let candidate = base;
        let counter = 2;
        while (usedVars.has(candidate)) {
            candidate = `${base}_${counter++}`;
        }
        usedVars.add(candidate);
        return candidate;
    };

    // Materialien deduplizieren & gemeinsame Referenzen erhalten
    const matDeclarations = [];
    const matSignatureMap = new Map();
    const matInstanceMap = new Map();
    let matCounter = 0;

    function getMaterialVar(mat) {
        if (!mat) return 'new THREE.MeshStandardMaterial()';
        if (matInstanceMap.has(mat)) return matInstanceMap.get(mat);

        const matType = ['MeshBasicMaterial', 'MeshPhongMaterial', 'MeshLambertMaterial', 'MeshStandardMaterial'].includes(mat.type)
            ? mat.type
            : 'MeshStandardMaterial';

        const props = [];
        if (mat.color) props.push(`color: 0x${mat.color.getHexString()}`);
        if (mat.roughness !== undefined && mat.roughness !== 1) props.push(`roughness: ${fmt(mat.roughness)}`);
        if (mat.metalness !== undefined && mat.metalness !== 0) props.push(`metalness: ${fmt(mat.metalness)}`);
        if (mat.emissive && mat.emissive.getHex() !== 0x000000) {
            props.push(`emissive: 0x${mat.emissive.getHexString()}`);
            if (mat.emissiveIntensity !== undefined && mat.emissiveIntensity !== 1) {
                props.push(`emissiveIntensity: ${fmt(mat.emissiveIntensity)}`);
            }
        }
        if (mat.transparent) props.push(`transparent: true`);
        if (mat.opacity !== undefined && mat.opacity < 1) props.push(`opacity: ${fmt(mat.opacity)}`);
        if (mat.wireframe) props.push(`wireframe: true`);
        if (mat.vertexColors) props.push(`vertexColors: true`);
        if (mat.side === THREE.DoubleSide) props.push(`side: THREE.DoubleSide`);
        else if (mat.side === THREE.BackSide) props.push(`side: THREE.BackSide`);

        const signature = `${matType}|{${props.join(', ')}}`;
        if (matSignatureMap.has(signature)) {
            const existingVar = matSignatureMap.get(signature);
            matInstanceMap.set(mat, existingVar);
            return existingVar;
        }

        const varName = makeUniqueVar(`mat_${matCounter++}`, 'mat');
        matDeclarations.push(`    const ${varName} = new THREE.${matType}({ ${props.join(', ')} });`);
        matSignatureMap.set(signature, varName);
        matInstanceMap.set(mat, varName);
        return varName;
    }

    let needsBufferHelper = false;

    function buildGeometryLines(geo, geoVar) {
        const lines = [];
        if (!geo) {
            lines.push(`    const ${geoVar} = new THREE.BoxGeometry(0.5, 0.5, 0.5);`);
            return lines;
        }

        const cleanType = (geo.type || '').replace('BufferGeometry', 'Geometry');
        const p = geo.parameters || {};
        let ctorExpr = null;

        switch (cleanType) {
            case 'BoxGeometry': {
                const args = trimDefaults(
                    [fmt(p.width ?? 1), fmt(p.height ?? 1), fmt(p.depth ?? 1), fmt(p.widthSegments ?? 1), fmt(p.heightSegments ?? 1), fmt(p.depthSegments ?? 1)],
                    ['1', '1', '1', '1', '1', '1']
                );
                ctorExpr = `new THREE.BoxGeometry(${args.join(', ')})`;
                break;
            }
            case 'SphereGeometry': {
                const args = trimDefaults(
                    [
                        fmt(p.radius ?? 1),
                        fmt(p.widthSegments ?? 8),
                        fmt(p.heightSegments ?? 6),
                        fmt(p.phiStart ?? 0),
                        fmt(p.phiLength ?? Math.PI * 2),
                        fmt(p.thetaStart ?? 0),
                        fmt(p.thetaLength ?? Math.PI)
                    ],
                    ['1', '8', '6', '0', fmt(Math.PI * 2), '0', fmt(Math.PI)]
                );
                ctorExpr = `new THREE.SphereGeometry(${args.join(', ')})`;
                break;
            }
            case 'CylinderGeometry': {
                const args = trimDefaults(
                    [
                        fmt(p.radiusTop ?? 1),
                        fmt(p.radiusBottom ?? 1),
                        fmt(p.height ?? 1),
                        fmt(p.radialSegments ?? 8),
                        fmt(p.heightSegments ?? 1),
                        String(Boolean(p.openEnded)),
                        fmt(p.thetaStart ?? 0),
                        fmt(p.thetaLength ?? Math.PI * 2)
                    ],
                    ['1', '1', '1', '8', '1', 'false', '0', fmt(Math.PI * 2)]
                );
                ctorExpr = `new THREE.CylinderGeometry(${args.join(', ')})`;
                break;
            }
            case 'ConeGeometry': {
                const args = trimDefaults(
                    [
                        fmt(p.radius ?? 1),
                        fmt(p.height ?? 1),
                        fmt(p.radialSegments ?? 8),
                        fmt(p.heightSegments ?? 1),
                        String(Boolean(p.openEnded)),
                        fmt(p.thetaStart ?? 0),
                        fmt(p.thetaLength ?? Math.PI * 2)
                    ],
                    ['1', '1', '8', '1', 'false', '0', fmt(Math.PI * 2)]
                );
                ctorExpr = `new THREE.ConeGeometry(${args.join(', ')})`;
                break;
            }
            case 'TorusGeometry': {
                const args = trimDefaults(
                    [
                        fmt(p.radius ?? 1),
                        fmt(p.tube ?? 0.4),
                        fmt(p.radialSegments ?? 8),
                        fmt(p.tubularSegments ?? 6),
                        fmt(p.arc ?? Math.PI * 2)
                    ],
                    ['1', '0.4', '8', '6', fmt(Math.PI * 2)]
                );
                ctorExpr = `new THREE.TorusGeometry(${args.join(', ')})`;
                break;
            }
            case 'TorusKnotGeometry': {
                const args = trimDefaults(
                    [
                        fmt(p.radius ?? 1),
                        fmt(p.tube ?? 0.4),
                        fmt(p.tubularSegments ?? 64),
                        fmt(p.radialSegments ?? 8),
                        fmt(p.p ?? 2),
                        fmt(p.q ?? 3)
                    ],
                    ['1', '0.4', '64', '8', '2', '3']
                );
                ctorExpr = `new THREE.TorusKnotGeometry(${args.join(', ')})`;
                break;
            }
            case 'PlaneGeometry': {
                const args = trimDefaults(
                    [fmt(p.width ?? 1), fmt(p.height ?? 1), fmt(p.widthSegments ?? 1), fmt(p.heightSegments ?? 1)],
                    ['1', '1', '1', '1']
                );
                ctorExpr = `new THREE.PlaneGeometry(${args.join(', ')})`;
                break;
            }
            case 'CircleGeometry': {
                const args = trimDefaults(
                    [fmt(p.radius ?? 1), fmt(p.segments ?? 8), fmt(p.thetaStart ?? 0), fmt(p.thetaLength ?? Math.PI * 2)],
                    ['1', '8', '0', fmt(Math.PI * 2)]
                );
                ctorExpr = `new THREE.CircleGeometry(${args.join(', ')})`;
                break;
            }
            case 'RingGeometry': {
                const args = trimDefaults(
                    [
                        fmt(p.innerRadius ?? 0.5),
                        fmt(p.outerRadius ?? 1),
                        fmt(p.thetaSegments ?? 8),
                        fmt(p.phiSegments ?? 1),
                        fmt(p.thetaStart ?? 0),
                        fmt(p.thetaLength ?? Math.PI * 2)
                    ],
                    ['0.5', '1', '8', '1', '0', fmt(Math.PI * 2)]
                );
                ctorExpr = `new THREE.RingGeometry(${args.join(', ')})`;
                break;
            }
            case 'IcosahedronGeometry':
            case 'DodecahedronGeometry':
            case 'OctahedronGeometry':
            case 'TetrahedronGeometry': {
                const args = trimDefaults([fmt(p.radius ?? 1), fmt(p.detail ?? 0)], ['1', '0']);
                ctorExpr = `new THREE.${cleanType}(${args.join(', ')})`;
                break;
            }
            case 'LatheGeometry': {
                if (Array.isArray(p.points)) {
                    const ptsStr = p.points.map(pt => `new THREE.Vector2(${fmt(pt.x)}, ${fmt(pt.y)})`).join(', ');
                    const args = trimDefaults(
                        [`[${ptsStr}]`, fmt(p.segments ?? 12), fmt(p.phiStart ?? 0), fmt(p.phiLength ?? Math.PI * 2)],
                        ['[]', '12', '0', fmt(Math.PI * 2)]
                    );
                    ctorExpr = `new THREE.LatheGeometry(${args.join(', ')})`;
                }
                break;
            }
        }

        if (ctorExpr) {
            lines.push(`    const ${geoVar} = ${ctorExpr};`);
            if (geo.attributes && geo.attributes.color) {
                const avgHex = getAverageVertexColorHex(geo, '#d4748c').replace('#', '0x');
                lines.push(`    if (typeof applyZombieRot === 'function') applyZombieRot(${geoVar}, ${avgHex});`);
            }
        } else {
            needsBufferHelper = true;
            const posArr = geo.attributes && geo.attributes.position ? Array.from(geo.attributes.position.array).map(fmt) : [];
            const normArr = geo.attributes && geo.attributes.normal ? Array.from(geo.attributes.normal.array).map(fmt) : [];
            const uvArr = geo.attributes && geo.attributes.uv ? Array.from(geo.attributes.uv.array).map(fmt) : [];
            const colArr = geo.attributes && geo.attributes.color ? Array.from(geo.attributes.color.array).map(fmt) : [];
            const idxArr = geo.index ? Array.from(geo.index.array) : [];
            lines.push(`    const ${geoVar} = _buildBufferGeo([${posArr.join(',')}], [${normArr.join(',')}], [${uvArr.join(',')}], [${colArr.join(',')}], [${idxArr.join(',')}]);`);
        }

        return lines;
    }

    const bodyLines = [];
    const detectedLegs = [];
    let detectedGunArm = null;

    function appendTransformAndMeta(obj, varName) {
        if (obj.name) {
            bodyLines.push(`    ${varName}.name = ${JSON.stringify(obj.name)};`);
        }
        if (obj.position.x !== 0 || obj.position.y !== 0 || obj.position.z !== 0) {
            bodyLines.push(`    ${varName}.position.set(${fmt(obj.position.x)}, ${fmt(obj.position.y)}, ${fmt(obj.position.z)});`);
        }
        if (obj.rotation.x !== 0 || obj.rotation.y !== 0 || obj.rotation.z !== 0) {
            bodyLines.push(`    ${varName}.rotation.set(${fmt(obj.rotation.x)}, ${fmt(obj.rotation.y)}, ${fmt(obj.rotation.z)});`);
        }
        if (obj.scale.x !== 1 || obj.scale.y !== 1 || obj.scale.z !== 1) {
            bodyLines.push(`    ${varName}.scale.set(${fmt(obj.scale.x)}, ${fmt(obj.scale.y)}, ${fmt(obj.scale.z)});`);
        }
        if (obj.visible === false) bodyLines.push(`    ${varName}.visible = false;`);
        if (obj.castShadow) bodyLines.push(`    ${varName}.castShadow = true;`);
        if (obj.receiveShadow) bodyLines.push(`    ${varName}.receiveShadow = true;`);
        if (obj.renderOrder !== 0) bodyLines.push(`    ${varName}.renderOrder = ${obj.renderOrder};`);
    }

    function traverseAndEmit(obj, parentVar) {
        if (obj.isMesh) {
            const meshVar = makeUniqueVar(obj.name, 'mesh');
            const geoVar = makeUniqueVar(`${obj.name || 'mesh'}_geo`, 'geo');
            const matVar = getMaterialVar(obj.material);

            bodyLines.push('');
            bodyLines.push(...buildGeometryLines(obj.geometry, geoVar));
            bodyLines.push(`    const ${meshVar} = new THREE.Mesh(${geoVar}, ${matVar});`);
            appendTransformAndMeta(obj, meshVar);

            const legMatch = (obj.name || '').match(/^leg(\d+)$/i);
            if (legMatch) {
                detectedLegs.push({ index: parseInt(legMatch[1], 10), varName: meshVar });
            }

            if (obj.children && obj.children.length > 0) {
                obj.children.forEach(child => traverseAndEmit(child, meshVar));
            }
            bodyLines.push(`    ${parentVar}.add(${meshVar});`);
        } else if (obj.isGroup || obj.isObject3D) {
            const grpVar = makeUniqueVar(obj.name, 'group');
            bodyLines.push('');
            bodyLines.push(`    const ${grpVar} = new THREE.Group();`);
            appendTransformAndMeta(obj, grpVar);

            const legMatch = (obj.name || '').match(/^leg(\d+)$/i);
            if (legMatch) {
                detectedLegs.push({ index: parseInt(legMatch[1], 10), varName: grpVar });
            }
            if (obj.name === 'armRGroup' || obj.name === 'gunArm') {
                detectedGunArm = grpVar;
            }

            if (obj.children && obj.children.length > 0) {
                obj.children.forEach(child => traverseAndEmit(child, grpVar));
            }

            if (obj.name === 'staticGroup' && parentVar === 'group') {
                const childMats = new Set();
                obj.traverse(c => { if (c.isMesh && c.material) childMats.add(getMaterialVar(c.material)); });
                if (childMats.size === 1) {
                    const singleMat = Array.from(childMats)[0];
                    bodyLines.push(`    group.add(typeof mergeGroupIntoSingleMesh === 'function' ? mergeGroupIntoSingleMesh(${grpVar}, ${singleMat}) : ${grpVar});`);
                } else {
                    bodyLines.push(`    group.add(${grpVar});`);
                }
            } else {
                bodyLines.push(`    ${parentVar}.add(${grpVar});`);
            }
        }
    }

    currentPig.children.forEach(child => traverseAndEmit(child, 'group'));

    detectedLegs.sort((a, b) => a.index - b.index);
    const legsArrayStr = detectedLegs.map(l => l.varName).join(', ');

    const activeArray = (guiParams.pigCategory === 'Schussschweine') ? (window.SHOOTER_PIGS || []) : (window.HORDE_PIGS || []);
    const selectedFn = activeArray[parseInt(guiParams.pigVariant, 10)];
    const fnName = (selectedFn && selectedFn.name) ? selectedFn.name : 'createCustomPig';

    const helperCode = needsBufferHelper ? `
    function _buildBufferGeo(pos, norm, uv, col, idx) {
        const g = new THREE.BufferGeometry();
        if (pos.length) g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        if (norm.length) g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
        if (uv.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        if (col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        if (idx.length) g.setIndex(idx);
        if (!norm.length) g.computeVertexNormals();
        return g;
    }\n` : '';

    const returnFields = [`mesh: group`, `legs: [${legsArrayStr}]`];
    if (detectedGunArm) returnFields.push(`gunArm: ${detectedGunArm}`);
    const exportType = guiParams.pigType || 0;
    if (exportType > 0) returnFields.push(`type: ${exportType}`);

    let finalHeadshotY = guiParams.headshotY;
    if (guiParams.autoHeadshotY && typeof autoDetectHeadHeight === 'function') {
        const detected = autoDetectHeadHeight(currentPig);
        if (detected !== null) {
            finalHeadshotY = detected;
            guiParams.headshotY = detected;
        }
    } else if (finalHeadshotY === undefined || finalHeadshotY === null) {
        finalHeadshotY = (typeof autoDetectHeadHeight === 'function' ? autoDetectHeadHeight(currentPig) : null) || 1.2;
    }

    if (finalHeadshotY !== undefined && finalHeadshotY !== null && !isNaN(finalHeadshotY)) {
        returnFields.push(`headshotY: ${fmt(finalHeadshotY)}`);
    }
    if (guiParams.headshotZ !== undefined && guiParams.headshotZ !== 0) {
        returnFields.push(`headshotZ: ${fmt(guiParams.headshotZ)}`);
    }

    const fullCode = [
        `function ${fnName}() {`,
        `    const group = new THREE.Group();`,
        `    group.name = 'pigGroup';`,
        helperCode,
        matDeclarations.length ? `    // Materialien\n${matDeclarations.join('\n')}` : '',
        ...bodyLines,
        '',
        `    group.rotation.set(${fmt(currentPig.rotation.x)}, ${fmt(currentPig.rotation.y)}, ${fmt(currentPig.rotation.z)});`,
        `    return { ${returnFields.join(', ')} };`,
        `}`
    ].filter((line, idx, arr) => !(line === '' && arr[idx - 1] === '')).join('\n');

    document.getElementById('exportTitle').innerText = `Dein fertiger Code (${fnName})`;
    document.getElementById('codeOutput').value = fullCode;
    document.getElementById('exportModal').style.display = 'flex';
}
