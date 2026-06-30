import { EL_ORO_BOUNDARY_RINGS } from "@/data/el-oro.boundary";
import { Polyline } from "@vis.gl/react-google-maps";

const PROVINCE_BORDER_OPTIONS: google.maps.PolylineOptions = {
  strokeOpacity: 0,
  strokeWeight: 2,
  clickable: false,
  zIndex: 1,
  icons: [
    {
      icon: {
        path: "M 0,-1 0,1",
        strokeOpacity: 1,
        strokeColor: "#ff385c",
        scale: 3,
      },
      offset: "0",
      repeat: "14px",
    },
  ],
};

export function ElOroProvinceBoundary() {
  return (
    <>
      {EL_ORO_BOUNDARY_RINGS.map((ring, index) => (
        <Polyline
          key={`el-oro-ring-${index}`}
          path={ring}
          strokeOpacity={PROVINCE_BORDER_OPTIONS.strokeOpacity}
          strokeWeight={PROVINCE_BORDER_OPTIONS.strokeWeight}
          clickable={PROVINCE_BORDER_OPTIONS.clickable}
          zIndex={PROVINCE_BORDER_OPTIONS.zIndex}
          icons={PROVINCE_BORDER_OPTIONS.icons}
        />
      ))}
    </>
  );
}
