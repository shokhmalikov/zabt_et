function getApproxArea(path) {
    if (path.length < 3) return 0;
    const R = 6371000;
    const lat0 = path[0][1] * Math.PI / 180;
    const pts = path.map(p => ({
        x: p[0] * Math.PI / 180 * R * Math.cos(lat0),
        y: p[1] * Math.PI / 180 * R
    }));
    let area = 0;
    for(let i=0; i<pts.length; i++){
        let j = (i + 1) % pts.length;
        area += pts[i].x * pts[j].y;
        area -= pts[j].x * pts[i].y;
    }
    return Math.abs(area / 2);
}

const path = [
    [69.2401, 41.2995],
    [69.2421, 41.2995],
    [69.2421, 41.3015],
    [69.2401, 41.2995]
];

console.log("Area:", getApproxArea(path));
